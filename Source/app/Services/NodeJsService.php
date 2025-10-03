<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NodeJsService
{
    protected $baseUrl;
    protected $enabled;

    public function __construct()
    {
        $this->baseUrl = config('services.nodejs.url', 'http://localhost:3000');
        $this->enabled = config('services.nodejs.enabled', true);
    }

    /**
     * Check if Node.js service is enabled
     *
     * @return bool
     */
    public function isEnabled()
    {
        return $this->enabled;
    }

    /**
     * Trigger campaign processing in Node.js
     *
     * @return bool
     */
    public function processCampaign()
    {
        if (!$this->enabled) {
            return false;
        }

        try {
            $response = Http::timeout(5)->post("{$this->baseUrl}/campaign/process");
            
            if ($response->successful()) {
                Log::info('Node.js campaign processing triggered', [
                    'processed' => $response->json('processed', 0)
                ]);
                return true;
            }

            Log::warning('Node.js campaign processing failed', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            return false;
        } catch (\Exception $e) {
            Log::error('Node.js campaign trigger failed', [
                'error' => $e->getMessage(),
                'url' => "{$this->baseUrl}/campaign/process"
            ]);
            return false;
        }
    }

    /**
     * Check Node.js service health
     *
     * @return array
     */
    public function healthCheck()
    {
        if (!$this->enabled) {
            return [
                'status' => 'disabled',
                'healthy' => false
            ];
        }

        try {
            $response = Http::timeout(2)->get("{$this->baseUrl}/health");
            
            if ($response->successful()) {
                return array_merge([
                    'healthy' => true
                ], $response->json());
            }

            return [
                'status' => 'unhealthy',
                'healthy' => false,
                'error' => 'Service returned ' . $response->status()
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'unreachable',
                'healthy' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Forward webhook to Node.js service
     *
     * @param string $vendorUid
     * @param array $payload
     * @return bool
     */
    public function forwardWebhook($vendorUid, $payload)
    {
        if (!$this->enabled) {
            return false;
        }

        try {
            // Send asynchronously - don't wait for response
            Http::async()->post("{$this->baseUrl}/webhook/{$vendorUid}", $payload);
            return true;
        } catch (\Exception $e) {
            Log::error('Webhook forwarding to Node.js failed', [
                'vendor' => $vendorUid,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
}
