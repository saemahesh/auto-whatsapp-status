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
 * ManualSubscriptionRepository.php - Repository file
 *
 * This file is part of the Subscription component.
 *-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Subscription\Repositories;

use App\Yantrana\Base\BaseRepository;
use App\Yantrana\Components\Subscription\Models\ManualSubscriptionModel;
use App\Yantrana\Components\Subscription\Interfaces\ManualSubscriptionRepositoryInterface;

class ManualSubscriptionRepository extends BaseRepository implements ManualSubscriptionRepositoryInterface
{
    /**
     * primary model instance
     *
     * @var  object
     */
    protected $primaryModel = ManualSubscriptionModel::class;


    /**
     * Fetch manualSubscription datatable source
     *
     * @return  mixed
     *---------------------------------------------------------------- */
    public function fetchManualSubscriptionDataTableSource($vendorId = null)
    {
        // basic configurations for dataTables data
        $dataTableConfig = [
            // searchable columns
            'searchable' => [
                'plan_id',
                'ends_at',
                'status',
                'remarks',
                'charges_frequency',
                'charges',
            ]
        ];
        // get Model result for dataTables
        if ($vendorId) {
            return ManualSubscriptionModel::where([
                'vendors__id' => $vendorId
            ])->dataTables($dataTableConfig)->toArray();
        }
        return ManualSubscriptionModel::with('vendor')->dataTables($dataTableConfig)->toArray();
    }

    /**
     * Delete $manualSubscription record and return response
     *
     * @param  object $inputData
     *
     * @return  mixed
     *---------------------------------------------------------------- */

    public function deleteManualSubscription($manualSubscription)
    {
        // Check if $manualSubscription deleted
        if ($manualSubscription->deleteIt()) {
            // if deleted
            return true;
        }
        // if failed to delete
        return false;
    }

    function getCurrentActiveSubscription($vendorId)
    {
        return $this->primaryModel::where([
            'vendors__id' => $vendorId,
            'status' => 'active',
        ])->latest()->first();
    }
}
