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
        if (!getAppSettings('enable_queue_jobs_for_campaigns')) {
            $schedule->command('whatsapp:campaign:process')
            ->everyFiveSeconds()
            ->name('process_messages_via_cron')
            ->withoutOverlapping(3) // Prevent overlapping executions
            ;
            if(getAppSettings('enable_wa_webhook_process_using_db')) {
                $schedule->command('whatsapp:webhooks:process')
                ->everySecond()
                ->name('process_webhooks_via_cron')
                ->withoutOverlapping(1) // Prevent overlapping executions
                ;
            }
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
