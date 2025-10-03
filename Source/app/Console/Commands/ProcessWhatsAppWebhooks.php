<?php
// app/Console/Commands/ProcessWhatsAppWebhooks.php
namespace App\Console\Commands;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Console\Command;
use Symfony\Component\HttpFoundation\HeaderBag;
use App\Yantrana\Components\WhatsAppService\WhatsAppServiceEngine;
use App\Yantrana\Components\WhatsAppService\Models\WhatsAppWebhookModel;

class ProcessWhatsAppWebhooks extends Command
{
    protected $signature = 'whatsapp:webhooks:process {webhooksCount=25}';
    protected $description = 'Process pending webhooks';
    public function handle()
    {
        $webhooksCount = $this->argument('webhooksCount') ?: 25;
        WhatsAppWebhookModel::where('status', 'pending')
            ->oldest()
            ->limit($webhooksCount)
            ->get()
            ->each(function ($webhook) {
                try {
                    $request = new Request(
                        query: [],
                        request: $webhook->payload,
                        attributes: [],
                        cookies: [],
                        files: [],
                        server: [],
                        content: json_encode($webhook->payload)
                    );
                    $request->headers = new HeaderBag($webhook->headers);
                    app()->make(WhatsAppServiceEngine::class)->processWebhookRequest($request, $webhook->vendors__id);
                    $webhook->delete();
                } catch (\Throwable $e) {
                    // __logDebug($e->getMessage());
                    // throw $e;
                    $webhook->update([
                        'status' => 'pending',
                        'attempted_at' => now(),
                    ]);
                }
            });
    }
}