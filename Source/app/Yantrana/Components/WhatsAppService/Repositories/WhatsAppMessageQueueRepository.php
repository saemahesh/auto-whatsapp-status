<?php
/**
* WhatsAppMessageQueueRepository.php - Repository file
*
* This file is part of the WhatsAppService component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\WhatsAppService\Repositories;

use App\Yantrana\Base\BaseRepository;
use App\Yantrana\Components\WhatsAppService\Interfaces\WhatsAppMessageQueueRepositoryInterface;
use App\Yantrana\Components\WhatsAppService\Models\WhatsAppMessageQueueModel;

class WhatsAppMessageQueueRepository extends BaseRepository implements WhatsAppMessageQueueRepositoryInterface
{
    /**
     * primary model instance
     *
     * @var object
     */
    protected $primaryModel = WhatsAppMessageQueueModel::class;

    /**
     * Stuck message processing
     *
     * @return int
     */
    public function stuckInProcessing()
    {
        $where = [
            'status' => 3, // processing
            [
                'scheduled_at', '<=', now()
            ],
            [
                'updated_at', '<=', now()->subMinutes(5)
            ]
        ];
        $stuckItemsCount = $this->primaryModel::where($where)->count();
        if ($stuckItemsCount) {
            // requeue stuck queue items in processing more than 10 minutes
            $this->updateIt($where, [
                'status' => 1, // queue
                '__data' => [
                    'process_response' => [
                        'error_status'  => 'requeued_connection_error',
                        'error_message' => 're-processing'
                    ]
                ]
            ]);
        }
        return $stuckItemsCount;
    }

    /**
     * Take the items from database for message process
     *
     * @return Eloquent Objects
     */
    public function getQueueItemsForProcess()
    {
        // go grab queue records for processing
        return $this->primaryModel::select([
            '_id',
            'status',
            'scheduled_at',
        ])->where([
            // waiting for processing
            'status' => 1,
            [
                // time has passed on
                'scheduled_at', '<=', now()
            ],
        ])->oldest()->take((getAppSettings('cron_process_messages_per_lot') ?: 35))->get();
    }
    /**
     * Queued messages count
     * $campaignId - Campaign Id
     *
     * @return int
     */
    public function campaignQueueItemsCount($campaignId)
    {
        return $this->primaryModel::where([
            'status' => 1,
            'campaigns__id' => $campaignId,
        ])->count();
    }
}
