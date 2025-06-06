
<!-- theme Menu -->
@php
//user current theme
$currentAppTheme=getUserAppTheme();
@endphp
<nav class="navbar navbar-top navbar-horizontal navbar-expand-md shadow-sm">
    <div class="container px-5">
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbar-collapse-main"
            aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon fa fa-bars"></span>
        </button>
        <a class="navbar-brand" href="{{ route('landing_page') }}">
            @if (isVendorShop())
                <img src="{{ getVendorSettings('logo_image_url') }}" class="navbar-brand-img"
                    alt="{{ getVendorSettings('name') }}" >
            @else
             <!-- App Theme Change -->
                 <!-- App Theme Change -->
    @if( $currentAppTheme=='dark')
    <img src="{{ getAppSettings('dark_theme_logo_image_url') }}" class="navbar-brand-img  dark-theme-logo" alt="{{ getAppSettings('name') }}">
    @elseif($currentAppTheme=='system_default')
     <!-- dark theme -->
     <img src="{{ getAppSettings('dark_theme_logo_image_url') }}" class="navbar-brand-img  dark-theme-logo system-theme-dark-logo" alt="{{ getAppSettings('name') }}" media="(prefers-color-scheme: dark)">
     <img src="{{ getAppSettings('logo_image_url') }}" class="navbar-brand-img light-theme-logo system-theme-light-logo" alt="{{ getAppSettings('name') }}">
   <!-- /light theme --> 
   @else
       <!-- light theme -->
       <img src="{{ getAppSettings('logo_image_url') }}" class="navbar-brand-img light-theme-logo" alt="{{ getAppSettings('name') }}">
        <!-- /light theme -->
   @endif
            @endif
        </a>
        <div class="collapse navbar-collapse" id="navbar-collapse-main">
            <!-- Collapse header -->
            <div class="navbar-collapse-header d-md-none">
                <div class="row">
                    <div class="col-6 collapse-brand">
                        <a class="navbar-brand pt-0" href="{{ url('/') }}">
                    <!-- App Theme Change -->
                    @if ($currentAppTheme == 'dark')
                        {{-- dark theme logo --}}
                        <img src="{{ getAppSettings('dark_theme_logo_image_url') }}"
                            class="card-img-top  dark-theme-logo" alt="{{ getAppSettings('name') }}">
                        <!-- /dark theme -->
                    @elseif($currentAppTheme == 'system_default')
                        <img src="{{ getAppSettings('logo_image_url') }}"
                            class="card-img-top light-theme-logo system-theme-light-logo"
                            alt="{{ getAppSettings('name') }}">
                        {{-- dark theme logo --}}
                        <img src="{{ getAppSettings('dark_theme_logo_image_url') }}"
                            class="card-img-top  dark-theme-logo system-theme-dark-logo"
                            alt="{{ getAppSettings('name') }}" media="(prefers-color-scheme: dark)">
                    @else
                        {{-- light theme logo --}}
                        <img src="{{ getAppSettings('logo_image_url') }}" class="card-img-top light-theme-logo"
                            alt="{{ getAppSettings('name') }}">
                        <!-- /App Theme Change -->
                    @endif
                    <!-- App Theme Change -->
                </a>
                    </div>
                    <div class="col-6 collapse-close">
                        <button type="button" class="navbar-toggler" data-toggle="collapse"
                            data-target="#navbar-collapse-main" aria-controls="sidenav-main" aria-expanded="false"
                            aria-label="Toggle sidenav">
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
            </div>
            <!-- Navbar items -->
            <ul class="navbar-nav ml-auto">
                @if (!getAppSettings('other_home_page_url'))
                <li class="nav-item">
                    <a class="nav-link" href="{{ url('/#features') }}">
                        <span class="nav-link-inner--text">{{ __tr('Features') }}</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="{{ url('/#pricing') }}">
                        <span class="nav-link-inner--text">{{ __tr('Pricing') }}</span>
                    </a>
                </li>
                @endif
                <li class="nav-item">
                    <a class="nav-link" href="{{ route('user.contact.form') }}">{{
                    __tr('Contact') }}</a>
                </li>
                  <!-- pages -->
                  <li class="nav-item">
                    @include('layouts.navbars.navs.pages-menu-partial')
                 </li>
                   <!-- /pages -->
                @if(getAppSettings('enable_vendor_registration') or getAppSettings('message_for_disabled_registration'))
                <li class="nav-item">
                    <a class="nav-link" href="{{ route('auth.register') }}">
                        <span class="nav-link-inner--text text-danger fw-bold">{{ __tr('Register') }}</span>
                    </a>
                </li>
                @endif
                <li class="nav-item">
                    <a class="nav-link" href="{{ route('auth.login') }}">
                        <span class="nav-link-inner--text">{{ __tr('Login') }}</span>
                    </a>
                </li>
                  <!--theme change -->
                  @if(getAppSettings('allow_to_change_theme'))
                  <li class="nav-item">
                     @include('layouts.navbars.app-theme')
                    </li>
                     @endif
                <!--theme change -->
                @include('layouts.navbars.locale-menu')
            </ul>
        </div>
    </div>
</nav>
