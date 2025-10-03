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
* ContactLabelRepository.php - Repository file
*
* This file is part of the Contact component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Contact\Repositories;

use App\Yantrana\Base\BaseRepository;
use App\Yantrana\Components\Contact\Models\ContactLabelModel;
use App\Yantrana\Components\Contact\Interfaces\ContactLabelRepositoryInterface;

class ContactLabelRepository extends BaseRepository implements ContactLabelRepositoryInterface
{
    /**
     * primary model instance
     *
     * @var  object
     */
    protected $primaryModel = ContactLabelModel::class;

    /**
     * Delete Selected Assigned labels from contact
     *
     * @param array $labelIds
     * @param int $contactId
     * @return mixed
     */
    public function deleteAssignedLabels($labelIds, $contactId)
    {
        return $this->primaryModel::whereIn('labels__id', $labelIds)->where([
            'contacts__id' => $contactId
        ])->deleteIt();
    }
}
