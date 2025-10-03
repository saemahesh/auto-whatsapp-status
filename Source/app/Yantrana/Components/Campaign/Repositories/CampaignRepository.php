<?php
/**
 * WhatsJet
 *
 * This file is part of the WhatsJet software package developed and licensed by livelyworks.
 *
 * You must have a valid license to use this software.
 *
 * © 2025 livelyworks. All rights reserved.
 * Redistribution or resale of this file, in whole or in part, is prohibited without prior written permission from the author.
 *
 * For support or inquiries, contact: contact@livelyworks.net
 *
 * @package     WhatsJet
 * @author      livelyworks <contact@livelyworks.net>
 * @copyright   Copyright (c) 2025, livelyworks
 * @website     https://livelyworks.net
 */

/**
* CampaignRepository.php - Repository file
*
* This file is part of the Campaign component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Campaign\Repositories;

use App\Yantrana\Base\BaseRepository;
use App\Yantrana\Components\Campaign\Interfaces\CampaignRepositoryInterface;
use App\Yantrana\Components\Campaign\Models\CampaignModel;
use App\Yantrana\Components\WhatsAppService\Models\WhatsAppMessageLogModel;
use App\Yantrana\Components\WhatsAppService\Models\WhatsAppMessageQueueModel;
use Illuminate\Support\Facades\DB;

class CampaignRepository extends BaseRepository implements CampaignRepositoryInterface
{
    /**
     * primary model instance
     *
     * @var object
     */
    protected $primaryModel = CampaignModel::class;

    /**
     * Fetch campaign datatable source
     *
     * @return mixed
     *---------------------------------------------------------------- */
    public function fetchCampaignDataTableSource($status)
    {
        if($status == "archived") {
            $status = 5;
        } else {
            $status = 1;
        }

        // basic configurations for dataTables data
        $dataTableConfig = [
            // searchable columns
            'searchable' => [
                'title',
                'whatsapp_templates__id',
                'scheduled_at',
            ],
            'fieldAlias' => [
                'contacts_count' => '__data->total_contacts'
            ]
        ];
        // get Model result for dataTables
        return $this->primaryModel::where([
            'vendors__id' => getVendorId()
            ])
            ->where('status', '=', $status)
            ->withCount([
            'messageLog',
            'queuePendingMessages',
            'queueProcessingMessages',
            'queueFailedMessages',
        ])->dataTables($dataTableConfig)->toArray();
    }

    /**
     * Get the campaign data
     *
     * @param int $campaignId
     * @return Eloquent
     */
    public function getCampaignData($campaignId)
    {
        return $this->primaryModel::where([
            'vendors__id' => getVendorId(),
            '_uid' => $campaignId,
        ])
        ->withCount('messageLog')->withCount([
            'queuePendingMessages',
            'queueProcessingMessages',
            'queueFailedMessages',
        ])->with([
            'messageLog' => function($query) {
                $query->whereNull('is_system_message');
            }, 
            'queueMessages'
        ])->first();
    }

    /**
     * Delete $campaign record and return response
     *
     * @param  object  $inputData
     * @return mixed
     *---------------------------------------------------------------- */
    public function deleteCampaign($campaign)
    {
        // Check if $campaign deleted
        if ($campaign->deleteIt()) {
            // if deleted
            return true;
        }
        // if failed to delete
        return false;
    }

    /**
     * Store new campaign record and return response
     *
     * @param  array  $inputData
     * @return mixed
     *---------------------------------------------------------------- */
    public function storeCampaign($inputData)
    {
        // prepare data to store
        $keyValues = [
            'title',
            'template_name',
            'whatsapp_templates__id' => $inputData['whatsapp_template'],
            'scheduled_at' => $inputData['schedule_at'],
        ];
        return $this->storeIt($inputData, $keyValues);
    }

    /**
     * Fetch campaign queue log datatable source
     *
     * @return mixed
     *---------------------------------------------------------------- */
    public function fetchCampaignQueueLogTableSource($campaignId)
    {
        // basic configurations for dataTables data
        $dataTableConfig = [
            // searchable columns
            'searchable' => [
                'fullName' => DB::raw("LOWER(CONCAT(
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
                ))"),
                'updated_at',
                'status',
                'phone_with_country_code',
            ],
            'fieldAlias' => [
                'formatted_status' => 'status',
            ]
        ];
        // search name in json
        request()->merge([
            'search' => [
                'value' => strtolower(request()->search['value'] ?? ''),
                'regex' => request()->search['regex'] ?? null
            ]
        ]);
        // Get Model result for dataTables
        return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
        ->whereNotIn('status', [5]) // Expired
        ->select(
            DB::raw(
                "*,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')) as first_name,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name')) as last_name,
            CONCAT(
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
            ) as full_name"
            )
        )
            ->dataTables($dataTableConfig)
            ->toArray();
    }
    /**
    * Fetch campaign datatable source
    *
    * @return mixed
    *---------------------------------------------------------------- */
    public function fetchCampaignExecutedLogTableSource($campaignId)
    {
        // basic configurations for dataTables data
        $dataTableConfig = [
            // searchable columns
            'searchable' => [
                'fullName' => DB::raw("LOWER(CONCAT(
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
                ))"),
                'contact_wa_id',
                'messaged_at',
                'updated_at',
                'status',
            ],
        ];
        // search name in json
        request()->merge([
            'search' => [
                'value' => strtolower(request()->search['value'] ?? ''),
                'regex' => request()->search['regex'] ?? null
            ]
        ]);
        // get Model result for dataTables
        return WhatsAppMessageLogModel::where('campaigns__id', $campaignId)
        ->select(
            DB::raw(
                "*,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')) as first_name,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name')) as last_name,
            CONCAT(
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
            ) as full_name"
            )
        )
        ->dataTables($dataTableConfig)
        ->toArray();
    }
    /**
    * Fetch campaign datatable source
    *
    * @return mixed
    *---------------------------------------------------------------- */
    public function fetchCampaignExpiredLogTableSource($campaignId)
    {
        // basic configurations for dataTables data
        $dataTableConfig = [
            // searchable columns
            'searchable' => [
                'fullName' => DB::raw("LOWER(CONCAT(
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                    JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
                ))"),
                'updated_at',
                'status',
                'phone_with_country_code',
            ],
        ];
        // search name in json
        request()->merge([
            'search' => [
                'value' => strtolower(request()->search['value'] ?? ''),
                'regex' => request()->search['regex'] ?? null
            ]
        ]);
        // Get Model result for dataTables
        return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
        ->where('status', 5) // Expired
        ->select(
            DB::raw(
                "*,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')) as first_name,
            JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name')) as last_name,
            CONCAT(
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.first_name')), ' ',
                JSON_UNQUOTE(JSON_EXTRACT(__data, '$.contact_data.last_name'))
            ) as full_name"
            )
        )
            ->dataTables($dataTableConfig)
            ->toArray();
    }
    /**
     * Get the campaign  Executed data
     *
     * @param int  $campaignId
     *
     * @return LazyCollection
     */
    public function fetchCampaignExecutedDataLazily($campaignId, $callback)
    {
        return WhatsAppMessageLogModel::where('campaigns__id', $campaignId)->lazy()->each($callback);
    }
    /**
    * Get the campaign queue log data
    *
    * @param int $campaignId

    * @return LazyCollection
    */
    public function fetchCampaignQueueLogDataLazily($campaignId, $callback)
    {
        return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
            ->whereNotIn('status', [5]) // Not Expired
            ->lazy()
            ->each($callback);
    }
    /**
    * Get the campaign expired log data
    *
    * @param int $campaignId

    * @return LazyCollection
    */
    public function fetchCampaignExpiredLogDataLazily($campaignId, $callback)
    {
        return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
            ->where('status', 5) // Expired
            ->lazy()
            ->each($callback);
    }

    /**
    * Get the campaign expired log data
    *
    * @param int $campaignId

    * @return LazyCollection
    */
    public function fetchFailedCampaignByType($campaignId, $failedCampaignType)
    {
        if ($failedCampaignType == 'queue') {
            return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
            ->select('_id', 'campaigns__id', 'contacts__id', 'status')
            ->whereNotIn('status', [5]) // Expired
            ->get();
        } elseif ($failedCampaignType == 'expired') {
            return WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
            ->select('_id', 'campaigns__id', 'contacts__id', 'status')
            ->where('status', 5) // Expired
            ->get();
        } elseif ($failedCampaignType == 'executed') {
            return WhatsAppMessageLogModel::where('campaigns__id', $campaignId)
                ->select('_id', 'campaigns__id', 'contacts__id')
                ->get();
        }
        
    }

    public function fetchTotalCampaignContacts($campaignId) 
    {
        $messageQueueData = WhatsAppMessageQueueModel::where('campaigns__id', $campaignId)
            ->select('_id', 'campaigns__id', 'contacts__id')
            ->get();

        $messageLogData = WhatsAppMessageLogModel::where('campaigns__id', $campaignId)
            ->select('_id', 'campaigns__id', 'contacts__id')
            ->get();

        return $messageQueueData->merge($messageLogData);
    }
}
