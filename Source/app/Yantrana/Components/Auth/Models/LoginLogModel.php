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
 * LoginLog.php - Model file
 *
 * This file is part of the Auth component.
 *-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Auth\Models;

use App\Yantrana\Base\BaseModel;

class LoginLogModel extends BaseModel
{
    /**
     * @var string - The database table used by the model.
     */
    protected $table = 'login_logs';

    /**
     * @var array - The attributes that should be casted to native types.
     */
    protected $casts = [];

    /**
     * @var array - The attributes that are mass assignable.
     */
    protected $fillable = [];

    /**
     * The generate UID or not
     *
     * @var string
     *----------------------------------------------------------------------- */
    protected $isGenerateUID = false;
}
