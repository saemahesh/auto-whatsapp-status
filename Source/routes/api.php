<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;
use App\Yantrana\Components\Auth\Controllers\ApiUserController;
use App\Yantrana\Components\Contact\Controllers\ContactController;
use App\Yantrana\Components\WhatsAppService\Controllers\WhatsAppServiceController;
use App\Yantrana\Components\Media\Controllers\MediaController;
use App\Yantrana\Components\User\Controllers\UserController;

use App\Yantrana\Components\{
    Auth\Controllers\AuthController
};

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});

// external apis
// base url
Route::any('/', function () {
    return 'api endpoint';
})->name('api.base_url');

Route::group([
    'middleware' => 'api.vendor.authenticate',
    'prefix' => '{vendorUid}/',
], function () {
    Route::post('/contact/send-message', [
        WhatsAppServiceController::class,
        'apiSendChatMessage',
    ])->name('api.vendor.chat_message.send.process');
    // send media message
    Route::post('/contact/send-media-message', [
        WhatsAppServiceController::class,
        'apiSendMediaChatMessage',
    ])->name('api.vendor.chat_message_media.send.process');
    // send media message
    Route::post('/contact/send-template-message', [
        WhatsAppServiceController::class,
        'apiSendTemplateChatMessage',
    ])->name('api.vendor.chat_template_message.send.process');
    // send interactive message
    Route::post('/contact/send-interactive-message', [
        WhatsAppServiceController::class,
        'apiSendInteractiveChatMessage',
    ])->name('api.vendor.chat_message_interactive.send.process');
    // create new contact
    Route::post('/contact/create', [
        ContactController::class,
        'apiProcessContactCreate',
    ])->name('api.vendor.contact.create.process');
    // update contact
    Route::post('/contact/update/{phoneNumber}', [
        ContactController::class,
        'apiProcessContactUpdate',
    ])->name('api.vendor.contact.update.process');
    // assign team member
    Route::post('/contact/assign-team-member', [
        ContactController::class,
        'apiAssignTeamMemberToContact',
    ])->name('api.vendor.contact.assign_member.update.process');
});

// Mobile app apis
Route::group(['middleware' => 'guest'], function () {

     //vendor registration
    Route::post('/register/vendor', [
        AuthController::class,
        'register',
    ])->name('api.auth.register.process');
     //vendor activation
    Route::post('/register/vendor/activation', [
        AuthController::class,
        'activationRequiredRegister',
    ])->name('api.activation_required.auth.register.process');

    Route::group([
        'prefix' => 'user',
    ], function () {
        // login process
        Route::post('/login-process', [
            ApiUserController::class,
            'loginProcess'
        ])->name('api.user.login.process');

        // User Registration prepare data
        Route::get('/prepare-sign-up', [
            ApiUserController::class,
            'prepareSignUp'
        ])->name('api.user.sign_up.prepare');

        // User Registration
        Route::post('/process-sign-up', [
            ApiUserController::class,
            'processSignUp'
        ])->name('api.user.sign_up.process');
       
    });
});
// vendor authenticated routes
Route::group([
    'middleware' => 'app_api.vendor.authenticate',
], function () {
    // broadcast private channel check
    Broadcast::routes([]);

    /*
    Media Component Routes Start from here
    ------------------------------------------------------------------- */
    Route::group([
        'prefix' => 'media',
    ], function () {
        // Temp Upload
        Route::post('/upload-temp-media/{uploadItem?}', [
            MediaController::class,
            'uploadTempMedia',
        ])->name('api.media.upload_temp_media');
    });

    Route::group([
        'prefix' => 'vendor/',
    ], function () {
        //unread chat count
        Route::get('/whatsapp/chat/unread-count', [
            WhatsAppServiceController::class,
            'unreadCount',
        ])->name('app_api.vendor.chat_message.read.unread_count');
        // get contacts data
        Route::get('/contact/contacts-data/{contactUid?}', [
            WhatsAppServiceController::class,
            'getContactsData',
        ])->name('app_api.vendor.contacts.data.read');
        // contact chat data
        Route::get('/whatsapp/contact/chat/{contactUid?}', [
            WhatsAppServiceController::class,
            'chatView',
        ])->name('app_api.vendor.chat_message.contact.view');
        // contact chat data via append, prepend etc
        Route::get('/whatsapp/contact/chat-data/{contactUid}/{way?}', [
            WhatsAppServiceController::class,
            'getContactChatData',
        ])->name('app_api.vendor.chat_message.data.read');
        Route::post('/whatsapp/contact/chat/send', [
            WhatsAppServiceController::class,
            'sendChatMessage',
        ])->name('app_api.vendor.chat_message.send.process');

        // Contact get labels and team members data
        Route::get('/whatsapp/contact/chat-box-data/{contactUid}', [
            ContactController::class,
            'getLabelsForApi',
        ])->name('app_api.chat.box.base.data');
            // Contact get the data
        Route::get('/contacts/{contactIdOrUid}/get-update-data', [
            ContactController::class,
            'updateContactData',
        ])->name('app_api.vendor.contact.read.update.data');
        //media type api
        Route::get('/whatsapp/contact/chat/prepare-send-media/{mediaType?}', [
            WhatsAppServiceController::class,
            'prepareSendMediaUploader',
        ])->name('app_api.vendor.chat_message_media.upload.prepare');
        Route::post('/whatsapp/contact/chat/send-media', [
            WhatsAppServiceController::class,
            'sendChatMessageMedia',
        ])->name('app_api.vendor.chat_message_media.send.process');
        Route::post('/whatsapp/contact/chat/update-notes', [
            ContactController::class,
            'updateNotes',
        ])->name('app_api.vendor.chat.update_notes.process');
        Route::post('/whatsapp/contact/chat/assign-user', [
            ContactController::class,
            'assignChatUser',
        ])->name('app_api.vendor.chat.assign_user.process');
        Route::post('/whatsapp/contact/chat/assign-labels', [
            ContactController::class,
            'assignContactLabels',
        ])->name('app_api.vendor.chat.assign_labels.process');
        //clear chat history
        Route::post('/whatsapp/contact/chat/clear-history/{contactUid}', [
            WhatsAppServiceController::class,
            'clearChatHistory',
        ])->name('app_api.vendor.chat_message.delete.process');
            //create whatsapp contact label
         Route::post('/whatsapp/contact/create-label', [
            ContactController::class,
            'createLabel',
        ])->name('app_api.vendor.chat.label.create.write');
        //whatsapp contact edit lable
            Route::post('/whatsapp/contact/chat/edit-label', [
            ContactController::class,
            'updateLabel',
        ])->name('app_api.vendor.chat.label.update.write');
            //whatsapp contact delete lable
            Route::post('/whatsapp/contact/chat/delete-label/{labelUid}', [
            ContactController::class,
            'deleteLabelProcess',
        ])->name('app_api.vendor.chat.label.delete.write');
           
    });
    // logout
    Route::post('/user/logout', [
        ApiUserController::class,
        'logout'
    ])->name('api.user.logout');
    Route::post('/update-password', [
        AuthController::class,
        'updatePassword',
    ])->name('api.auth.password.update.process');
  
    // profile update request
    Route::post('/user/profile-update', [
        UserController::class,
        'updateProfile',
    ])->name('api.user.profile.update');
   
    // Account Activation
    Route::get('/{userUid}/account-activation', [
        AuthController::class,
        'accountActivation',
    ])->name('api.user.account.activation');
});
