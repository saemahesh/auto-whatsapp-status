<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Yantrana\Components\WhatsAppService\WhatsAppServiceEngine;

class ProcessWhatsappCampaign extends Command
{
    protected $signature = 'whatsapp:campaign:process';
    protected $description = 'Process WhatsApp campaign messages from scheduler';

    public function handle(): int
    {
        emptyFlashCache(); // Clear flash cache before processing
        // Call the service method
        app()->make(WhatsAppServiceEngine::class)->processCampaignSchedule();
        return self::SUCCESS;
    }
}
