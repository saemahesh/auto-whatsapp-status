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
* LanguageUpdateRequest.php - Request file
*
* This file is part of the Translation component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Translation\Requests;

use App\Yantrana\Base\BaseRequest;

class LanguageUpdateRequest extends BaseRequest
{
    /**
     * Loosely sanitize fields.
     *------------------------------------------------------------------------ */
    protected $looseSanitizationFields = [];

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     *-----------------------------------------------------------------------*/
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the add author client post request.
     *
     * @return bool
     *-----------------------------------------------------------------------*/
    public function rules()
    {
        $inputData = $this->all();
        $formKey = $inputData['form_key'];

        \Validator::extend('unique_language_name', function ($attribute, $value) use ($formKey) {
            $translationLanguages = getAppSettings('translation_languages');
            if (__ifIsset($translationLanguages[$formKey])) {
                unset($translationLanguages[$formKey]);
            }
            if (in_array(strtolower($value), array_map('strtolower', array_column($translationLanguages, 'name')))) {
                return false;
            }

            return true;
        });

        $rules = [
            'language_name_'.$formKey => 'required|min:3|max:15|unique_language_name',
        ];

        return $rules;
    }

    /**
     * Set custom msg for field
     *
     * @return array
     *-----------------------------------------------------------------------*/
    public function messages()
    {
        $inputData = $this->all();
        $formKey = $inputData['form_key'];

        return [
            'language_name_'.$formKey.'.unique_language_name' => __tr('The :attribute has already been taken'),
        ];
    }
}
