<?php

/**
 * ConfigurationController.php - Controller file
 *
 * This file is part of the Configuration component.
 *-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Configuration\Controllers;

use Artisan;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use App\Yantrana\Base\BaseRequest;
use Illuminate\Support\Facades\Http;
use App\Yantrana\Base\BaseController;
use App\Yantrana\Base\BaseRequestTwo;
use Illuminate\Support\Facades\Route;
use App\Yantrana\Components\Configuration\ConfigurationEngine;
use App\Yantrana\Components\Configuration\Requests\ConfigurationRequest;

class ConfigurationController extends BaseController
{
    /**
     * @var ConfigurationEngine - Configuration Engine
     */
    protected $configurationEngine;

    /**
     * Constructor
     *
     * @param  ConfigurationEngine  $configurationEngine  - Configuration Engine
     * @return void
     *-----------------------------------------------------------------------*/
    public function __construct(ConfigurationEngine $configurationEngine)
    {
        $this->configurationEngine = $configurationEngine;
    }

    /**
     * Get Configuration Data.
     *
     * @param  string  $pageType
     * @return json object
     *---------------------------------------------------------------- */
    public function getConfiguration($pageType)
    {
        $processReaction = $this->configurationEngine->prepareConfigurations($pageType);
        // check if settings available
        abortIf(!file_exists(resource_path("views/configuration/$pageType.blade.php")));
        // load view
        return $this->loadView('configuration.settings', $processReaction->data(), [
            'compress_page' => false
        ]);
    }

    /**
     * Get Configuration Data.
     *
     * @param  string  $pageType
     * @return json object
     *---------------------------------------------------------------- */
    public function processStoreConfiguration(ConfigurationRequest $request, $pageType)
    {
       
        /*         $validationRules = [
                    'pageType' => 'required',
                ]; */
        $request->validate($this->settingsValidationRules($request->pageType, [], $request->all()));
        $processReaction = $this->configurationEngine->processConfigurationsStore($pageType, $request->all());

        return $this->responseAction($this->processResponse($processReaction, [], [], true));
    }

    /**
     * Setup validation array
     *
     * @param  string  $pageType
     * @param  array  $validationRules
     * @param  array  $inputFields
     * @return mixed
     */
    protected function settingsValidationRules($pageType, $validationRules = [], $inputFields = [])
    {
        if (! $pageType) {
            return $validationRules;
        }
        foreach (config('__settings.items.' . $pageType) as $settingItemKey => $settingItemValue) {
            $settingsValidationRules = Arr::get($settingItemValue, 'validation_rules', []);
            $isValueHidden = Arr::get($settingItemValue, 'hide_value');
            if ($settingsValidationRules) {
                // skip validation if hidden value item and empty and the value is already set
                if (!array_key_exists($settingItemKey, $inputFields) or ($isValueHidden and !(Arr::has($inputFields, $settingItemKey)) and getAppSettings($settingItemKey))) {
                    continue;
                }
                $existingItemRules = Arr::get($validationRules, $settingItemKey, []);
                $validationRules[$settingItemKey] = array_merge(
                    ! is_array($existingItemRules) ? [$existingItemRules] : $existingItemRules,
                    $settingsValidationRules
                );
            }
        }
        return $validationRules;
    }

    /**
     * Optimize system
     *
     * @param  BaseRequest  $request
     * @return void
     *---------------------------------------------------------------- */
    public function optimizeApp(BaseRequest $request)
    {
        Artisan::call('optimize:clear');
        Artisan::call('optimize');
        return $this->processResponse(21, [
            21 => __tr('Optimized')
        ], [
            'reloadPage' => true,
            'show_message' => true,
            'messageType' => 'success',
        ], true);
    }
    /**
     * Clear system cache
     *
     * @param  BaseRequest  $request
     * @return void
     *---------------------------------------------------------------- */
    public function clearOptimize(BaseRequest $request)
    {
        Artisan::call('optimize:clear');
        return $this->processResponse(21, [
            21 => __tr('Optimization Cleared')
        ], [
            'reloadPage' => true,
            'show_message' => true,
            'messageType' => 'success',
        ], true);
    }

    /**
     * Register view
     *
     * @return void
     *---------------------------------------------------------------- */
    public function registerProductView()
    {
        return $this->loadView('configuration.licence-information');
    }

    /**
     * Process product registration
     *
     *
     * @return void
     *---------------------------------------------------------------- */
    public function processProductRegistration(ConfigurationRequest $request)
    {
        $processReaction = $this->configurationEngine->processProductRegistration($request->all());

        return $this->responseAction($this->processResponse($processReaction, [], [], true));
    }

    /**
     * Process product registration
     *
     *
     * @return void
     *---------------------------------------------------------------- */
    public function processProductRegistrationRemoval(ConfigurationRequest $request)
    {
        // remote removal
        $existingRegistrationId = getAppSettings('product_registration', 'registration_id');
        if (!$request->isMethod('post') and $existingRegistrationId and (!$request->registration_id or ($existingRegistrationId != $request->registration_id))) {
            abort(404, __tr('Invalid Request'));
        }

        $processReaction = $this->configurationEngine->processProductRegistrationRemoval();

        return $this->responseAction($this->processResponse($processReaction, [], [], true));
    }

    /**
     * Subscription Plans
     *
     * @return void
     *---------------------------------------------------------------- */
    public function subscriptionPlans()
    {
        return $this->loadView('configuration.subscription-plans', [
            'planDetails' => getPaidPlans(),
            'freePlan' => getFreePlan(),
            'planStructure' => getConfigPaidPlans(),
            'freePlanStructure' => getConfigFreePlan(),
        ]);
    }

    /**
     * Update Plan Settings
     *
     *
     * @return void
     *---------------------------------------------------------------- */
    public function subscriptionPlansProcess(BaseRequest $request)
    {
        // set as paid plan default
        $planType = 'paid';
        // get paid plan structure from config
        $plan = getConfigPaidPlans($request->config_plan_id);
        // if not found then it may be free plan
        if (__isEmpty($plan)) {
            // set it as free
            $planType = 'free';
        }

        $validationRules = [
            'title' => 'required|min:3',
        ];

        // if the plan is free get it & its features
        if ($planType == 'free') {
            $features = getConfigFreePlan('features');
            $planCharges = null;
        } else {
            // if the plan is paid get it & its features
            $features = getConfigPaidPlans("{$request->config_plan_id}.features");
            $planCharges = getConfigPaidPlans("{$request->config_plan_id}.charges");
        }

        $isPlanEnabled = ($request->enabled == 'on') or ($request->enabled == 1) or ($request->enabled == true);

        // if($request->enabled == 'on') {
        if (! __isEmpty($features)) {
            // go through each feature
            foreach ($features as $featureKey => $feature) {
                $validationRules[$featureKey.'_limit'] = 'required|integer|min:-1';
            }
        }

        $isChargesPresent = 0;

        if (! __isEmpty($planCharges)) {
            foreach ($planCharges as $chargeKey => $chargeItem) {
                if ($request->{$chargeKey.'_enabled'}) {
                    $isChargesPresent++;
                    $validationRules[$chargeKey.'_enabled'] = [
                        Rule::in(['on', 1]),
                    ];
                    $validationRules[$chargeKey.'_plan_price_id'] = 'nullable|starts_with:price_';
                    $validationRules[$chargeKey.'_charge'] = 'numeric|min:0.1';
                }
            }
        }

        if (! $isChargesPresent and ($planType != 'free') and $isPlanEnabled) {
            $validationRules['charges'] = 'required';
        }
        // }
        $request->validate($validationRules, [
            'charges.required' => __tr('You need to select at least one charge for the plan.'),
        ]);
        $processReaction = $this->configurationEngine->processSubscriptionPlans($request->all());

        return $this->responseAction($this->processResponse($processReaction, [], [], true));
    }

    public function createStripeWebhook()
    {
        if (!config('cashier.secret')) {
            return $this->processResponse(2, [], [
                'show_message' => true,
                'message' => __tr('Missing Stripe keys. First add keys & update and then ask to process to create webhook.'),
            ], true);
        }
        // webhook
        $webhookUrl = getViaSharedUrl(route('cashier.webhook'));
        try {
            $stripe = new \Stripe\StripeClient(config('cashier.secret')); // config('cashier.secret')
            $webhookCreated = $stripe->webhookEndpoints->create([
            // https://laravel.com/docs/10.x/billing#handling-stripe-webhooks
            // https://docs.stripe.com/api/webhook_endpoints/create
            // copied from /vendor/laravel/cashier/src/Console/WebhookCommand.php
            'enabled_events' => [
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted',
                'customer.updated',
                'customer.deleted',
                'payment_method.automatically_updated',
                'invoice.payment_action_required',
                'invoice.payment_succeeded',
            ],
            'url' => $webhookUrl,
            ]);
            if ($webhookCreated and $webhookCreated['status'] == 'enabled') {
                $apiMode = $webhookCreated['livemode'] ? 'live' : 'testing';
                $now = now();
                // store webhook created info
                $this->configurationEngine->processConfigurationsStore('internals', [
                    'payment_gateway_info' => [
                        'auto_stripe_webhook_info' => [
                            $apiMode => [
                                'created_at' => $now,
                                'response' => $webhookCreated
                            ]
                        ]
                    ]
                ]);
                // store webhook created secret
                $this->configurationEngine->processConfigurationsStore('payment', [
                    'stripe_'. $apiMode .'_webhook_secret' => $webhookCreated['secret']
                ], true);

                if ($apiMode == 'testing') {
                    updateClientModels([
                        'lastTestWebhookCreatedAt' => formatDateTime($now),
                    ]);
                } else {
                    updateClientModels([
                        'lastLiveWebhookCreatedAt' => formatDateTime($now),
                    ]);
                }

                return $this->processResponse(1, [], [
                    'show_message' => true,
                    'message' => __tr('Stripe Webhook created successfully'),
                ], false);
            }
            return $this->processResponse(2, [], [
                'show_message' => true,
                'message' => __tr('Failed to create Stripe Webhook created, you may need to do it manually'),
            ], true);
        } catch (\Throwable $th) {
            return $this->processResponse(2, [], [
                'show_message' => true,
                'message' => $th->getMessage(),
            ], true);
        }
        return $this->processResponse(2, [
            2 => __tr('Failed to create Stripe Webhook created, you may need to do it manually')
        ], [
            'show_message' => true
        ], true);
    }

    /**
     * Addons page
     *
     * @return view
     */
    public function showAddonsPage()
    {
        $allAddons = [];
        $availableAddons = [];
        $addonsPath = base_path('addons');
        if (is_dir($addonsPath)) {
            $skipDirsItems = [
                '.',
                '..',
                '.DS_Store'
            ];
            foreach (scandir($addonsPath) as $addon) {
                if (in_array($addon, $skipDirsItems)) {
                    continue;
                }
                if (!Route::has('addon.'. $addon .'.setup_view')) {
                    continue;
                }

                $addonPath = $addonsPath . '/' . $addon;
                // Load addon if it has a service provider
                $addonMetaDataPath = $addonPath . '/config/metadata.php';
                if (isset($allAddons[$addon])) {
                    $allAddons[$addon] = arrayExtend(
                        [
                            'identifier' => $addon,
                            'installed' => true,
                        ],
                        $allAddons[$addon]
                    );
                } else {
                    $allAddons[$addon] = [
                        'identifier' => $addon,
                        'installed' => true,
                    ];
                }

                if (is_dir($addonPath) && file_exists($addonMetaDataPath)) {
                    $allAddons[$addon] = arrayExtend(
                        require $addonMetaDataPath,
                        $allAddons[$addon],
                    );
                    $addonSystem = $addonPath . '/config/lwSystem.php';
                    if (file_exists($addonSystem)) {
                        $addonSystem = require $addonSystem;
                        $allAddons[$addon]['installed_version'] = $addonSystem['version'];
                        if (Route::has('addon.'. $addon.'.setup_view')) {
                            $allAddons[$addon]['setup_url'] = route('addon.'. $addon.'.setup_view');
                        }
                    }
                    $allAddons[$addon]['thumbnail'] = ($allAddons[$addon]['thumbnail'] ?? '') ? route('addon.'. $addon.'.assets', [
                            'path' => ($allAddons[$addon]['thumbnail'] ?? '')
                        ]) : '';
                }
            }
        }
        try {
            // Make the GET request
            $response = Http::withHeaders([
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ])->get('https://product-info-metadata.livelyworks.net/whatsjet-available-addons.json?ver='. uniqid());
            // Check if the request was successful
            if ($response->successful()) {
                // Decode JSON into an array
                $availableAddons = $response->json();
                foreach ($availableAddons as $availableAddon) {
                    if (isset($allAddons[$availableAddon['identifier']])) {
                        $allAddons[$availableAddon['identifier']] = arrayExtend($allAddons[$availableAddon['identifier']], $availableAddon);
                    } else {
                        $allAddons[$availableAddon['identifier']] = $availableAddon;
                    }
                }
            }
        } catch (\Exception $e) {
        }
        // load the view
        return $this->loadView('configuration.addons', [
            'availableAddons' => $availableAddons,
            'allAddons' => $allAddons
        ]);
    }

    /**
     * Import Contacts
     *
     * @param BaseRequestTwo $request
     * @return json
     */
    public function installAddon(BaseRequestTwo $request)
    {
        // restrict demo user
        if (isDemo()) {
            return $this->processResponse(22, [
                22 => __tr('Functionality is disabled in this demo.')
            ], [], true);
        }
        $request->validate([
            'document_name' => 'required'
        ]);
        return $this->processResponse(
            $this->configurationEngine->processInstallAddon($request),
            [],
            [],
            true
        );
    }
     /**
     * Mobile App Configuration page
     *
     * @return view
     */
    public function showMobileAppConfiguration(){
         $subscriptionPlans =  getPaidPlans();
        return $this->loadView('configuration.mobile-app', ['creditPackages' => $subscriptionPlans],[
            'compress_page' => false
        ]);

    }
}
