<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        //
    ];

    /**
     * Define the application's command schedule.
     *
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        // Check if Node.js service is enabled
        $nodejsEnabled = config('services.nodejs.enabled', false);

        if (!getAppSettings('enable_queue_jobs_for_campaigns')) {
            if ($nodejsEnabled) {
                // Use Node.js service for campaign processing
                $schedule->command('whatsapp:campaign:nodejs')
                ->everyFiveSeconds()
                ->name('process_messages_via_nodejs')
                ->withoutOverlapping(3);
            } else {
                // Fallback to PHP processing if Node.js is disabled
                $schedule->command('whatsapp:campaign:process')
                ->everyFiveSeconds()
                ->name('process_messages_via_cron')
                ->withoutOverlapping(3);
            }
            
            // Webhook processing is now handled by Node.js directly, no cron needed
            // The webhook route forwards requests to Node.js in real-time
            // Keeping old command commented out for reference:
            // if(getAppSettings('enable_wa_webhook_process_using_db')) {
            //     $schedule->command('whatsapp:webhooks:process')
            //     ->everySecond()
            //     ->name('process_webhooks_via_cron')
            //     ->withoutOverlapping(1);
            // }
        }
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
