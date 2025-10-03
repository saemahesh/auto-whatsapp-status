<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\NodeJsService;

class ProcessCampaignViaNodeJs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'whatsapp:campaign:nodejs';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Trigger Node.js service to process campaign messages';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle(NodeJsService $nodeJsService)
    {
        if (!$nodeJsService->isEnabled()) {
            $this->warn('Node.js service is disabled. Enable it in .env file.');
            return 1;
        }

        $this->info('Triggering Node.js campaign processing...');
        
        $success = $nodeJsService->processCampaign();
        
        if ($success) {
            $this->info('✓ Campaign processing triggered successfully');
            return 0;
        } else {
            $this->error('✗ Failed to trigger campaign processing');
            return 1;
        }
    }
}
