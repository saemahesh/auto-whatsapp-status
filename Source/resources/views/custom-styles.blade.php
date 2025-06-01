@php
$currentAppTheme ='';
 // Default theme from settings
 $currentAppTheme = getUserAppTheme()
@endphp

     
html > body {
background-color: {{ getAppSettings('app_bg_color') }}!important;
}
.card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation {
background-color: {{ darkenColorValue(getAppSettings('app_bg_color'), 9) }}!important;
}
.navbar.lw-sidebar-container {
background-color: {{ getAppSettings('app_sidebar_bg_color') }}!important;
}
.navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link[data-toggle=collapse]:after,
.navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link,
.navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link .fa {
color: {{ getAppSettings('app_sidebar_text_color') }}!important;
}
@php
$bootstrapClasses = [
'primary' => '#007bff',
'secondary' => '#6c757d',
'success' => '#28a745',
'danger' => '#dc3545',
'warning' => '#ffc107',
'info' => '#17a2b8',
'light' => '#f8f9fa',
'dark' => '#343a40',
'muted' => '#8898aa',
];
$css = '';
@endphp
@foreach ($bootstrapClasses as $bootstrapClass => $bootstrapClassValue)
@php
$bgColor = getAppSettings('app_bs_color_'.$bootstrapClass) ?: $bootstrapClassValue;
@endphp
@if($bootstrapClass == 'primary')
.card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .user-bar {
background-color: {{ darkenColorValue($bgColor, 35) }}!important;
}
.card.lw-whatsapp-chat-block-container .nav-tabs {
border-color: {{ $bgColor }} !important;
}
.lw-page-title,a {
color: {{ $bgColor }};
}
.lw-page-title:hover,a:hover {
color: {{ darkenColorValue($bgColor, 20) }};
}
.card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation-compose .send .circle {
background-color: {{ $bgColor }};
border-color: {{ darkenColorValue($bgColor, 10) }};
}
@endif
.mdtoast.mdt--{{ $bootstrapClass }}
@if($bootstrapClass == 'primary')
,.lw-minimized-menu .navbar-vertical.navbar-expand-md .navbar-nav .nav-link.active:before,
div:where(.swal2-container) button:where(.swal2-styled).swal2-confirm, .dropdown-item.active, .dropdown-item:active
,.main-content .navbar-top
@endif
{
background-color: {{ $bgColor }};
border-color: {{ darkenColorValue($bgColor, 10) }};
color: #ffffff;
}
@php
$css .= ".bg-$bootstrapClass { background-color: $bgColor !important; }\n";
// Text colors
$css .= ".text-$bootstrapClass { color: $bgColor !important; }\n";
// Button colors
$css .= ".btn-outline-$bootstrapClass:not(:disabled):not(.disabled).active, .btn-outline-$bootstrapClass:not(:disabled):not(.disabled):active, .show>.btn-outline-$bootstrapClass.dropdown-toggle,.btn.btn-$bootstrapClass { background-color: $bgColor !important; border-color: $bgColor !important; color:
#fff !important; }\n";
$css .= ".btn.btn-$bootstrapClass:hover { background-color: ". darkenColorValue($bgColor, 10) ." !important;
border-color: ". darkenColorValue($bgColor, 10) ." !important; }\n";
$css .= ".btn.btn-outline-$bootstrapClass { color: $bgColor !important; border-color: $bgColor !important; }\n";
$css .= ".btn.btn-outline-$bootstrapClass:hover { background-color: $bgColor !important; color: #fff !important; }\n";
// Alert colors
$css .= ".alert.alert-$bootstrapClass { background-color: $bgColor !important; border-color: ".
darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";
// Badge colors
$css .= ".badge.badge-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";

// Card colors
$css .= ".card.card-$bootstrapClass { background-color: $bgColor !important; border-color: ". darkenColorValue($bgColor,
5) ." !important; color: #fff !important; }\n";

// List group colors
$css .= ".list-group-item.list-group-item-$bootstrapClass { background-color: $bgColor !important; border-color: ".
darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";

// Table row colors
$css .= ".table.table-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";

// Border colors
$css .= ".border.border-$bootstrapClass { border-color: $bgColor !important; }\n";
@endphp
@endforeach
{!! $css !!}
@if (getAppSettings('disable_bg_image'))
html > body {
    background: {{ getAppSettings('app_bg_color') }}!important;
}
@endif


{{-- dark theme colors --}}
@if($currentAppTheme=='dark')


    html > body {
    background-color: {{ getAppSettings('dark_theme_app_bg_color') }}!important;
    }
    .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation {
    background-color: {{ darkenColorValue(getAppSettings('dark_theme_app_bg_color'), 9) }}!important;
    }
    .navbar.lw-sidebar-container ,.navbar-collapse {
    background-color: {{ getAppSettings('dark_theme_app_sidebar_bg_color') }}!important;
    }
    .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link[data-toggle=collapse]:after,
    .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link,
    .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link .fa {
    color: {{ getAppSettings('dark_theme_app_sidebar_text_color') }}!important;
    }
    @php
    $css = '';
    @endphp
    @foreach ($bootstrapClasses as $bootstrapClass => $bootstrapClassValue)
    @php
    $bgColor = getAppSettings('dark_theme_app_bs_color_'.$bootstrapClass) ?: $bootstrapClassValue;
    @endphp
    @if($bootstrapClass == 'primary')
    .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .user-bar {
    background-color: {{ darkenColorValue($bgColor) }}!important;
    }
    .card.lw-whatsapp-chat-block-container .nav-tabs {
    border-color: {{ $bgColor }} !important;
    }
    .lw-page-title,a {
    color: {{ $bgColor }};
    }
    .lw-page-title:hover,a:hover {
    color: {{ darkenColorValue($bgColor, 20) }};
    }
    .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation-compose .send .circle {
    background-color: {{ $bgColor }};
    border-color: {{ darkenColorValue($bgColor, 10) }};
    }
    @endif
    .mdtoast.mdt--{{ $bootstrapClass }}
    @if($bootstrapClass == 'primary')
    ,.lw-minimized-menu .navbar-vertical.navbar-expand-md .navbar-nav .nav-link.active:before,
    div:where(.swal2-container) button:where(.swal2-styled).swal2-confirm, .dropdown-item.active, .dropdown-item:active
    ,.main-content .navbar-top
    @endif
    {
    background-color: {{ $bgColor }};
    border-color: {{ darkenColorValue($bgColor, 10) }};
    color: #ffffff;
    }
    @php
    $css .= ".bg-$bootstrapClass { background-color: $bgColor !important; }\n";
    // Text colors
    $css .= ".text-$bootstrapClass { color: $bgColor !important; }\n";
    // Button colors
    $css .= ".btn-outline-$bootstrapClass:not(:disabled):not(.disabled).active, .btn-outline-$bootstrapClass:not(:disabled):not(.disabled):active, .show>.btn-outline-$bootstrapClass.dropdown-toggle,.btn.btn-$bootstrapClass { background-color: $bgColor !important; border-color: $bgColor !important; color:
    #fff !important; }\n";
    $css .= ".btn.btn-dark, .alert.alert-dark{ 
        color: #000 !important; 
    }\n";
    $css .= ".btn.btn-$bootstrapClass:hover { background-color: ". darkenColorValue($bgColor, 10) ." !important;
    border-color: ". darkenColorValue($bgColor, 10) ." !important; }\n";
    $css .= ".btn.btn-outline-$bootstrapClass { color: $bgColor !important; border-color: $bgColor !important; }\n";
    $css .= ".btn.btn-outline-$bootstrapClass:hover { background-color: $bgColor !important; color: #fff !important; }\n";
    // Alert colors
    $css .= ".alert.alert-$bootstrapClass { background-color: $bgColor !important; border-color: ".
    darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";
    // Badge colors
    $css .= ".badge.badge-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";

    // Card colors
    $css .= ".card.card-$bootstrapClass { background-color: $bgColor !important; border-color: ". darkenColorValue($bgColor,
    5) ." !important; color: #fff !important; }\n";

    // List group colors
    $css .= ".list-group-item.list-group-item-$bootstrapClass { background-color: $bgColor !important; border-color: ".
    darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";

    // Table row colors
    $css .= ".table.table-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";
    // Border colors
    $css .= ".border.border-$bootstrapClass { border-color: $bgColor !important; }\n";
    @endphp
    @endforeach
    {!! $css !!}
    @if (getAppSettings('disable_bg_image'))
    html > body {
        background: {{ getAppSettings('dark_theme_app_bg_color') }}!important;
    }
  
    @endif
    @endif
    @if($currentAppTheme=='system_default')
   
        @media (prefers-color-scheme: dark) {
    html > body {
        background-color: {{ getAppSettings('dark_theme_app_bg_color') }}!important;
        }
        .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation {
        background-color: {{ darkenColorValue(getAppSettings('dark_theme_app_bg_color'), 9) }}!important;
        }
        .navbar.lw-sidebar-container ,.navbar-collapse {
        background-color: {{ getAppSettings('dark_theme_app_sidebar_bg_color') }}!important;
        }
        .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link[data-toggle=collapse]:after,
        .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link,
        .navbar.lw-sidebar-container.navbar-light .navbar-nav .nav-link .fa {
        color: {{ getAppSettings('dark_theme_app_sidebar_text_color') }}!important;
        }
        @php
        $css = '';
        @endphp
        @foreach ($bootstrapClasses as $bootstrapClass => $bootstrapClassValue)
        @php
        $bgColor = getAppSettings('dark_theme_app_bs_color_'.$bootstrapClass) ?: $bootstrapClassValue;
        @endphp
        @if($bootstrapClass == 'primary')
        .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .user-bar {
        background-color: {{ darkenColorValue($bgColor) }}!important;
        }
        .card.lw-whatsapp-chat-block-container .nav-tabs {
        border-color: {{ $bgColor }} !important;
        }
        .lw-page-title,a {
        color: {{ $bgColor }};
        }
        .lw-page-title:hover,a:hover {
        color: {{ darkenColorValue($bgColor, 20) }};
        }
        .card.lw-whatsapp-chat-block-container .lw-whatsapp-chat-window .conversation-compose .send .circle {
        background-color: {{ $bgColor }};
        border-color: {{ darkenColorValue($bgColor, 10) }};
        }
        @endif
        .mdtoast.mdt--{{ $bootstrapClass }}
        @if($bootstrapClass == 'primary')
        ,.lw-minimized-menu .navbar-vertical.navbar-expand-md .navbar-nav .nav-link.active:before,
        div:where(.swal2-container) button:where(.swal2-styled).swal2-confirm, .dropdown-item.active, .dropdown-item:active
        ,.main-content .navbar-top
        @endif
        {
        background-color: {{ $bgColor }};
        border-color: {{ darkenColorValue($bgColor, 10) }};
        color: #ffffff;
        }
        @php
        $css .= ".bg-$bootstrapClass { background-color: $bgColor !important; }\n";
        // Text colors
        $css .= ".text-$bootstrapClass { color: $bgColor !important; }\n";
        // Button colors
        $css .= ".btn-outline-$bootstrapClass:not(:disabled):not(.disabled).active, .btn-outline-$bootstrapClass:not(:disabled):not(.disabled):active, .show>.btn-outline-$bootstrapClass.dropdown-toggle,.btn.btn-$bootstrapClass { background-color: $bgColor !important; border-color: $bgColor !important; color:
        #fff !important; }\n";
        $css .= ".btn.btn-dark, .alert.alert-dark{ 
            color: #000 !important; 
        }\n";
        $css .= ".btn.btn-$bootstrapClass:hover { background-color: ". darkenColorValue($bgColor, 10) ." !important;
        border-color: ". darkenColorValue($bgColor, 10) ." !important; }\n";
        $css .= ".btn.btn-outline-$bootstrapClass { color: $bgColor !important; border-color: $bgColor !important; }\n";
        $css .= ".btn.btn-outline-$bootstrapClass:hover { background-color: $bgColor !important; color: #fff !important; }\n";
        // Alert colors
        $css .= ".alert.alert-$bootstrapClass { background-color: $bgColor !important; border-color: ".
        darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";
        // Badge colors
        $css .= ".badge.badge-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";
    
        // Card colors
        $css .= ".card.card-$bootstrapClass { background-color: $bgColor !important; border-color: ". darkenColorValue($bgColor,
        5) ." !important; color: #fff !important; }\n";
    
        // List group colors
        $css .= ".list-group-item.list-group-item-$bootstrapClass { background-color: $bgColor !important; border-color: ".
        darkenColorValue($bgColor, 5) ." !important; color: #fff !important; }\n";
    
        // Table row colors
        $css .= ".table.table-$bootstrapClass { background-color: $bgColor !important; color: #fff !important; }\n";
        // Border colors
        $css .= ".border.border-$bootstrapClass { border-color: $bgColor !important; }\n";
        @endphp
        @endforeach
        {!! $css !!}
        @if (getAppSettings('disable_bg_image'))
        html > body {
            background: {{ getAppSettings('dark_theme_app_bg_color') }}!important;
        }
        @endif
    }
@endif
