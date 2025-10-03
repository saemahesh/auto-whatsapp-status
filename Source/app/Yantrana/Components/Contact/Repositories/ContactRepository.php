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
* ContactRepository.php - Repository file
*
* This file is part of the Contact component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Contact\Repositories;

use Illuminate\Support\Facades\DB;
use libphonenumber\PhoneNumberUtil;
use App\Yantrana\Base\BaseRepository;
use libphonenumber\NumberParseException;
use Illuminate\Database\Query\JoinClause;
use App\Yantrana\Support\Country\Models\Country;
use App\Yantrana\Components\Contact\Models\ContactModel;
use App\Yantrana\Components\Contact\Interfaces\ContactRepositoryInterface;

class ContactRepository extends BaseRepository implements ContactRepositoryInterface
{
    /**
     * primary model instance
     *
     * @var object
     */
    protected $primaryModel = ContactModel::class;

    /**
     * Fetch contact datatable source
     *
     * @return mixed
     *---------------------------------------------------------------- */
    public function fetchContactDataTableSource($groupContactIds = null, $contactGroupUid = null)
    {
        // basic configurations for dataTables data
        $dataTableConfig = [
             'fieldAlias' => [
                'phone_number' => 'wa_id'
             ],
            // searchable columns
            'searchable' => [
                'first_name',
                'last_name',
                'countries__id',
                'wa_id',
                'email',
            ],
        ];

        // get Model result for dataTables
        $query = $this->primaryModel::with([
            'groups' => function ($query) {
                $query->distinct('_id');
            },
            'lastIncomingMessage'
        ])
        ->where([
            'vendors__id' => getVendorId()
        ]);
        if ($contactGroupUid) {
            $query->whereIn('_id', $groupContactIds);
        }
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }
        return $query->dataTables($dataTableConfig)->toArray();
    }

    /**
     * Delete $contact record and return response
     *
     * @param  object  $inputData
     * @return mixed
     *---------------------------------------------------------------- */
    public function deleteContact($contact)
    {
        // Check if $contact deleted
        if ($contact->deleteIt()) {
            // if deleted
            return true;
        }

        // if failed to delete
        return false;
    }

    /**
     * Store new contact record and return response
     *
     * @param  array  $inputData
     * @return mixed
     *---------------------------------------------------------------- */
    public function storeContact($inputData, $vendorId = null)
    {
        if (!$vendorId) {
            $vendorId = getVendorId();
        }
        // prepare data to store
        $keyValues = [
            'first_name',
            'last_name',
            'countries__id' => $inputData['country'] ?? null,
            'email',
            'language_code',
            'whatsapp_opt_out' => (isset($inputData['whatsapp_opt_out']) and $inputData['whatsapp_opt_out']) ? 1 : null,
            'wa_id' => $inputData['phone_number'],
            'vendors__id' => $vendorId,
        ];
        if (isset($inputData['enable_ai_bot'])) {
            $keyValues['disable_ai_bot'] = ($inputData['enable_ai_bot']) ? 0 : 1;
        } else {
            $keyValues['disable_ai_bot'] = getVendorSettings('default_enable_flowise_ai_bot_for_users', null, null, $vendorId) ? 0 : 1;
        }

        if (isset($inputData['enable_reply_bot'])) {
            $keyValues['disable_reply_bot'] = ($inputData['enable_reply_bot']) ? 0 : 1;
        }

        return $this->storeIt($inputData, $keyValues);
    }
    /**
     * Get vendor contact based on _id,_uid or phone_number which is wa_id
     *
     * @param string|integer|null $contactIdOrUid
     * @param string|null $vendorId
     * @return Eloquent object
     */
    public function getVendorContact(string|int|null $contactIdOrUid, ?string $vendorId = null)
    {
        $findBy = [
            'vendors__id' => $vendorId ? $vendorId : getVendorId(),
        ];

        if (request()->phone_number and isExternalApiRequest()) {
            $findBy['wa_id'] = (string) request()->phone_number;
        } else {
            if (is_numeric($contactIdOrUid)) {
                $findBy['_id'] = $contactIdOrUid;
            } else {
                $findBy['_uid'] = $contactIdOrUid;
            }
        }

        return $this->with([
            'lastMessage',
            'customFieldValues'
        ])->fetchIt($findBy);
    }

    /**
     * Get contact by phone number and vendor id
     * If the contact does not found we will check db if it is stored without country code and will update the same.
     *
     * @param int $waId
     * @param int|null $vendorId
     * @return Eloquent
     */
    public function getVendorContactByWaId(int $waId, ?int $vendorId = null)
    {
        $contact = $this->fetchIt([
            'vendors__id' => $vendorId ? $vendorId : getVendorId(),
            'wa_id' => (string) $waId,
        ]);

        if (__isEmpty($contact)) {
            $phoneUtil = PhoneNumberUtil::getInstance();
            $localNumber = null;
            $countryCode = null;
            try {
                // Remove non-numeric characters
                $phoneNumber = preg_replace('/[^0-9]/', '', $waId);
                // Parse the phone number assuming it's from a default region (e.g., India)
                $numberProto = $phoneUtil->parse('+' .$phoneNumber, null);
                // Get the country code and national (local) number
                $countryCode = $numberProto->getCountryCode();
                $localNumber = $numberProto->getNationalNumber();
            } catch (NumberParseException $e) {
                $localNumber = null; // Invalid phone number
            }

            if ($localNumber) {
                $contact = $this->fetchIt([
                    'vendors__id' => $vendorId ? $vendorId : getVendorId(),
                    'wa_id' => (string) $localNumber,
                ]);
                if (!__isEmpty($contact)) {
                    $dataToUpdate = [
                        'wa_id' => $waId,
                    ];
                    if (!$contact->countries__id and $countryCode) {
                        $dataToUpdate['countries__id'] = findRequestedCountryId($countryCode);
                    }
                    $this->updateIt($contact, $dataToUpdate);
                    $contact = $contact->fresh();
                }
            }
        }
        return $contact;
    }

    /**
     * Get the contact with unread message details using contact uid and vendor uid
     *
     * @param string|null $contactUid
     * @param int|null $vendorId
     * @param string|null $assigned
     * @return Eloquent
     */
    public function getVendorContactWithUnreadDetails($contactUid = null, $vendorId = null, $assigned = null)
    {
        $whereClause = [
            'vendors__id' => $vendorId ?: getVendorId(),
        ];
        if ($contactUid) {
            $whereClause['_uid'] = $contactUid;
        }
        $query = $this->primaryModel::where($whereClause)->with([
            'lastMessage',
            'lastUnreadMessage',
            'lastIncomingMessage',
            'labels'
        ])->withCount('unreadMessages');

        if ($assigned == 'to-me') {
            $query->where('assigned_users__id', getUserID());
        } elseif ($assigned == 'unassigned') {
            $query->whereNull('assigned_users__id');
        }

        if (!$contactUid) {
            $query->has('lastIncomingMessage');
        }

        return $query->first();
    }

    /**
     * Get contacts by vendor id
     *
     * @param string|null $vendorId
     * @return Eloquent
     */
    public function getVendorContactsWithUnreadDetails($vendorId = null, $assigned = null)
    {
        $searchQuery = e(strip_tags(request()->search));
        $unreadOnly = (!request()->unread_only or (request()->unread_only == 'false')) ? false : true;
        $selectedLabel = request()->selected_labels;
        $query = $this->primaryModel::where([
            'contacts.vendors__id' => $vendorId ?: getVendorId(),
        ]);
        $assigned  = e($assigned ?: request()->assigned);
        $requestContactUid = e(request()->request_contact);
        $userId = getUserID();
        $isRestrictedVendorUser = (!hasVendorAccess() ? hasVendorAccess('assigned_chats_only') : false);
        // tab selection
        $assignedWhereClause = [];
        if (($assigned == 'to-me')) {
            $assignedWhereClause['assigned_users__id'] = $userId;
        } elseif (($assigned == 'unassigned')) {
            $assignedWhereClause['assigned_users__id'] = null;
        } elseif (is_numeric($assigned)) {
            $assignedWhereClause['assigned_users__id'] = $assigned;
        }
        if ($isRestrictedVendorUser and ($assigned != 'unassigned')) {
            $assignedWhereClause['assigned_users__id'] = $userId;
        }
        if (!empty($assignedWhereClause)) {
            $query->where($assignedWhereClause);
        }
        if ($requestContactUid) {
            $query->where('_uid', $requestContactUid);
        }
        $query->join(
            DB::raw('(SELECT contacts__id, MAX(messaged_at) as latest_message FROM whatsapp_message_logs GROUP BY contacts__id) as latest_messages'),
            'contacts._id',
            '=',
            'latest_messages.contacts__id'
        )
        ->orderBy('latest_messages.latest_message', 'desc')
        ->leftJoin(
            DB::raw('(SELECT contacts__id, COUNT(*) as unread_messages_count FROM whatsapp_message_logs WHERE status = "received" AND is_incoming_message = 1 GROUP BY contacts__id) as unread_counts'),
            'contacts._id',
            '=',
            'unread_counts.contacts__id'
        );
        if ($selectedLabel) {
            $sub = DB::table('contact_labels')
            ->select('contact_labels.contacts__id', 'contact_labels.labels__id')
            ->join('labels', 'contact_labels.labels__id', '=', 'labels._id')
            ->where('contact_labels.labels__id', $selectedLabel)
            ->groupBy('contact_labels.contacts__id', 'contact_labels.labels__id');
            $query->leftJoinSub($sub, 'contact_labels_concat', function ($join) {
                $join->on('contacts._id', '=', 'contact_labels_concat.contacts__id');
            })
            ->where('contact_labels_concat.labels__id', '=', $selectedLabel);
        }
        if ($unreadOnly) {
            $query->whereNotNull('unread_counts.unread_messages_count');
        }
        if ($searchQuery) {
            $query->whereAny([
                DB::raw('CONCAT(first_name, " ", last_name)'),
                'wa_id',
            ], 'LIKE', '%'. $searchQuery .'%');
        }

        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }

        return $query->with([
            'lastMessage',
            'labels'
            ])
            // ->withCount('unreadMessages')
            ->has('lastIncomingMessage')
            ->simplePaginate(12);
    }

    /**
     * Delete the selected contacts based on uids provided
     * for the logged in vendor
     *
     * @param array $contactUids
     * @param integer|null $vendorId
     * @return mixed
     */
    public function deleteSelectedContacts(array $contactUids, int|null $vendorId = null)
    {
        return $this->primaryModel::where([
            'vendors__id' => $vendorId ?: getVendorId()
        ])->whereIn('_uid', $contactUids)->delete();
    }

    /**
     * Get all the contacts for vendor lazily with croup and custom field values
     *
     * @param int $vendorId
     * @param function $callBack
     *
     * @return LazyCollection
     */
    public function getAllContactsForTheVendorLazily($vendorId, $callback)
    {
        $query = $this->primaryModel::with(['groups', 'customFieldValues'])->where([
            'vendors__id' => $vendorId
        ]);
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }
        return $query->lazy()->each($callback);
    }

    /**
     * Count for campaigns
     *
     * @param array $whereClauses
     * @param array $groupContactIds
     * @param array $labelIds
     * @return int
     */
    public function countContactsForCampaign($whereClauses, $groupContactIds, $labelIds)
    {
        $query = $this->primaryModel::where($whereClauses);
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }

        if (!empty($labelIds)) {
            $query->select('contacts._id');
            $query->join('contact_labels', 'contacts._id', '=', 'contact_labels.contacts__id');
            $query->join('labels', 'contact_labels.labels__id', '=', 'labels._id');
            $query->whereIn('labels._id', $labelIds); // Match any of the given label IDs
            $query->distinct();
        }

        if (empty($groupContactIds)) {
            return $query->count();
        }
        return $query->whereIn('contacts._id', $groupContactIds)->count();
    }

    /**
     * Get Contacts for campaign in chunks
     *
     * @param array $whereClauses
     * @param array $groupContactIds
     * @param array $labelIds
     * @param function $callback
     * @return Object
     */
    public function getContactsForCampaignInChunks($whereClauses, $groupContactIds, $labelIds, $callback)
    {
        $query = $this->primaryModel::where($whereClauses);
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }
        if (!empty($labelIds)) {
            $query->select('contacts.*');
            $query->join('contact_labels', 'contacts._id', '=', 'contact_labels.contacts__id');
            $query->join('labels', 'contact_labels.labels__id', '=', 'labels._id');
            $query->whereIn('labels._id', $labelIds); // Match any of the given label IDs
            $query->distinct();
        }
        if (empty($groupContactIds)) {
            return $query->chunk(500, $callback);
        }
        return $query->whereIn('contacts._id', $groupContactIds)->chunk(500, $callback);
    }

    /**
     * Get total contacts count for the vendor
     *
     * @param int $vendorId
     * @return int
     */
    public function totalContactsCountForVendor($vendorId)
    {
        $query = $this->primaryModel::where([
            'vendors__id' => $vendorId
        ]);
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }
        // demo account restriction
        if (isThisDemoVendorAccountAccess()) {
            $query->whereIn('wa_id', getDemoNumbersForTest());
        }

        return $query->count();
    }

    /**
     * Fetch contact with assigned user
     *
     * @param int $contactIdOrUid
     * @return int
     */
    public function fetchContactWithAssignUser($contactIdOrUid) 
    {
        return $this->primaryModel::where([
            '_uid' => $contactIdOrUid
        ])->with('assignedUser')->first();
    }

    public function assignTeamMemberToContacts($contactUIDs, $inputData) 
    {
        return $this->primaryModel::whereIn('_uid', $contactUIDs)
            ->update([
                'assigned_users__id' => $inputData['assign_user_id']
            ]);
    }

    public function deleteAllContact($vendorId, $testContactUid)
    {
        return $this->primaryModel::where([
             'vendors__id' => $vendorId
        ])->whereNotIn('_uid', [$testContactUid])->delete();
    }
}
