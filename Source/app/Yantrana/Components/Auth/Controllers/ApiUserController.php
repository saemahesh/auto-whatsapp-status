<?php
/**
* UserController.php - Controller file
*
* This file is part of the User component.
*-----------------------------------------------------------------------------*/

namespace App\Yantrana\Components\Auth\Controllers;

use Illuminate\Http\Request;
use App\Yantrana\Base\BaseController;
use App\Yantrana\Support\CommonPostRequest;
use App\Yantrana\Components\Auth\AuthEngine;
use App\Yantrana\Components\User\UserEngine;
use App\Yantrana\Support\CommonUnsecuredPostRequest;
use App\Yantrana\Components\Auth\Requests\LoginRequest;
use App\Yantrana\Components\User\Requests\UserLoginRequest;
use App\Yantrana\Components\User\Requests\VerifyOtpRequest;
use App\Yantrana\Components\User\Requests\UserSignUpRequest;
use App\Yantrana\Components\User\Requests\UserChangeEmailRequest;
use App\Yantrana\Components\User\Requests\UserUpdatePasswordRequest;
use App\Yantrana\Components\User\Requests\ApiUserResetPasswordRequest;

class ApiUserController extends BaseController
{
    /**
     * @var AuthEngine - Auth Engine
     */
    protected $authEngine;

    /**
     * Constructor.
     *
     * @param  AuthEngine  $userEngine - User Engine
     *-----------------------------------------------------------------------*/
    public function __construct(AuthEngine $authEngine)
    {
        $this->authEngine = $authEngine;
    }

    /**
     * Authenticate user based on post form data.
     *
     * @param object LoginRequest $request
     * @return json object
     *---------------------------------------------------------------- */
    public function loginProcess(LoginRequest $request)
    {
        $processReaction = $this->authEngine->processLogin($request);

        return $this->processResponse($processReaction, [], [], true);
    }

    /**
     * Prepare user signup
     *
     * @return json object
     *---------------------------------------------------------------- */
    public function prepareSignUp()
    {
        // $processReaction = $this->userEngine->prepareSignupData();

        // return $this->processResponse($processReaction, [], [], true);
    }

    /**
     * Prepare user signup
     *
     * @return json object
     *---------------------------------------------------------------- */
    public function processSignUp(UserSignUpRequest $request)
    {
        // $processReaction = $this->userEngine->userSignUpProcess($request->all());

        // return $this->processResponse($processReaction, [], [], true);
    }

    

    /**
     * Process logout
     *
     * @return json object
     *-----------------------------------------------------------------------*/
    public function logout(CommonPostRequest $request)
    {
        $processReaction = $this->authEngine->processLogout($request);

        return $this->processResponse($processReaction, [], [], true);
    }
}
