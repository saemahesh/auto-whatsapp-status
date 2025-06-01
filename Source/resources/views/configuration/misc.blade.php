<!-- Page Heading -->
@php
$availableHomePages = [
    'outer-home' => __tr('Home Page 1'),
    'outer-home-2' => __tr('Home Page 2'),
    'outer-home-3' => __tr('Home Page 3')
];
@endphp
<section>
    <h1>{!! __tr('Misc Settings') !!}</h1>
 <!-- /Select Default Home Page -->
    <fieldset x-data="{panelOpened:false}" x-cloak>
        <legend @click="panelOpened = !panelOpened">{{ __tr('Home Page Settings') }} <small class="text-muted">{{  __tr('Click to expand/collapse') }}</small></legend>
        <form x-show="panelOpened" class="lw-ajax-form lw-form" method="post" action="<?= route('manage.configuration.write', ['pageType' => 'misc_settings']) ?>">
             <!-- Select home page  -->
            <x-lw.input-field type="selectize" data-form-group-class="col-md-4" name="current_home_page_view" data-selected="{{ getAppSettings('current_home_page_view') }}"
     :label="__tr('Select home page')" placeholder="{{ __tr('Select home page') }}" required>
     <x-slot name="selectOptions">
        @foreach ($availableHomePages as $availableHomePageKey => $availableHomePage)
            <option value="{{ $availableHomePageKey }}">{{ $availableHomePage }}</option>
        @endforeach
     </x-slot>
 </x-lw.input-field>
  <!-- /Select home page  -->
 <h3 class="my-5 col-md-4 text-center text-muted">{{  __tr('------- OR -------') }}</h3>
        <div class="mb-3 mb-sm-0 col-md-4">
            <label id="lwOtherHomePage">{{  __tr('External Home page') }} </label>
            <div class="form-group">
                <label id="lwOtherHomePageUrl">{{  __tr('Set home page url if you want to use other home page than default') }} </label>
                <input type="url" class="form-control" id="lwOtherHomePageUrl" name="other_home_page_url" value='{{ getAppSettings('other_home_page_url') }}'>
            </div>
        </div>
        <hr>
        <div class="form-group col" name="footer_code">
            <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">{{ __tr('Save') }}</button>
        </div>
    </form>
    </fieldset>
    <fieldset x-data="{panelOpened:false}" x-cloak>
        <legend @click="panelOpened = !panelOpened">{{ __tr('Excel Contacts Import Limit') }} <small class="text-muted">{{  __tr('Click to expand/collapse') }}</small></legend>
        <form x-show="panelOpened" class="lw-ajax-form lw-form" method="post" action="<?= route('manage.configuration.write', ['pageType' => 'misc_settings']) ?>">
            <x-lw.input-field data-form-group-class="col-xl-2 col-lg-2 col-sm-6 col-md-3" type="number" min="0" :label="__tr('Number of Contacts')" name="contacts_import_limit_per_request" value="{{ getAppSettings('contacts_import_limit_per_request') }}" :helpText="__tr('Set the limit of the contacts vendors can import using Excel file in single request')" required />
            <div class="form-group col">
                <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">{{ __tr('Save') }}</button>
            </div>
        </form>
    </fieldset>
</section>
<section class="mt-4">
    <h1>{!! __tr('Look and Feel') !!}</h1>
    <fieldset x-data="{panelOpened:false}" x-cloak>
        @php
        $appDefaultStyles = config('__settings.items.application_styles_and_colors');
        $darkThemeAppColorStyles = config('__settings.items.application_dark_theme_styles_and_colors');
        $skipItems = [
            'disable_bg_image',
            'allow_to_change_theme'
        ]
        @endphp
        <legend @click="panelOpened = !panelOpened">{{ __tr('Make it yours') }} <small class="text-muted">{{  __tr('Click to expand/collapse') }}</small></legend>
        <form x-show="panelOpened" class="lw-ajax-form lw-form" data-show-processing="true" method="post" action="{{ route('manage.configuration.write', ['pageType' => 'misc_settings']) }}" x-data="">
            <div class="row">
                <!-- enable/disable Background Image -->
              <div class="col-4">
                  <x-lw.checkbox id="disableBgImage" name="disable_bg_image" :offValue="0" :checked="getAppSettings('disable_bg_image')" data-lw-plugin="lwSwitchery" :label="__tr('Disable Background Image')" />
              </div>
                <!-- enable/disable Background Image -->
                <!-- enable/disable change theme -->
              <div class="col-4">
                  <x-lw.checkbox id="allowChangeTheme" name="allow_to_change_theme" :offValue="0" :checked="getAppSettings('allow_to_change_theme')" data-lw-plugin="lwSwitchery" :label="__tr('Allow User To Change Theme')" />
              </div>
                <!-- /enable change theme -->
          <!-- /Select Default Theme -->
          </div>
               <!-- Select Default Theme -->
               <div class="row mt-2">
                  <div class="col-4">
                      <label for="lwSelectDefaultTheme"><?= __tr('Default Mode') ?></label>
                      <select 
                          id="lwSelectDefaultTheme" 
                          data-lw-plugin="lwSelectize" 
                          placeholder="Default Theme..." 
                          name="current_app_theme"
                          onchange="updateTheme(this.value)"
                      >
                          @foreach(configItem('theme_options') as $appThemeKey => $appTheme)
                              <option 
                                  value="{{ $appThemeKey }}" 
                                  {{ $appThemeKey ===  getAppSettings('current_app_theme')  ? 'selected' : '' }}>
                                  {{ $appTheme }}
                              </option>
                          @endforeach
                      </select>
                  </div>
              </div>
              <div class="row">
                <!-- /Sidebar color on Store Front -->
                <div class="col-12 text-right clear mt-3">
                    <!-- Update Button -->
                    <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">
                        <?= __tr('Save') ?>
                    </button>
                    <!-- /Update Button -->
                </div>
            </div>
          
          <hr class="my-3">
        </form>
           <!-- light theme color style -->
        <form x-show="panelOpened" class="lw-ajax-form lw-form" data-show-processing="true" method="post" action="{{ route('manage.configuration.write', ['pageType' => 'application_styles_and_colors']) }}" x-data="{
            @foreach ($appDefaultStyles as $styleItem)
            '{{ $styleItem['key'] }}':'{{ getAppSettings($styleItem['key']) }}',
            @endforeach
        }">
            <input type="hidden" name="pageType" value="application_styles_and_colors">
            <div class="row">
                <div class="col">
                    <h2>{{  __tr('Choose your colors') }}</h2>
                </div>
            </div>
            <div class="row">
            @foreach ($appDefaultStyles as $styleItem)
            @if (in_array($styleItem['key'], $skipItems))
                @continue
            @endif
            <x-lw.input-field data-form-group-class="col-xl-2 col-lg-3 col-sm-6 col-md-6" type="color" x-model="{{ $styleItem['key'] }}" :label="$styleItem['title']" data-default="{{ $styleItem['default'] }}" name="{{ $styleItem['key'] }}" required />
            @endforeach
        </div>
        <div class="row">
            <!-- /Sidebar color on Store Front -->
            <div class="col-12 text-right clear mt-3">
                <button type="button" @click="__DataRequest.updateModels({@foreach ($appDefaultStyles as $styleItem)'{{ $styleItem['key'] }}':'{{ $styleItem['default'] }}',@endforeach});" class="btn btn-secondary lw-btn-block-mobile">
                    <?= __tr('Reset to Default') ?>
                </button>
                <!-- Update Button -->
                <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">
                    <?= __tr('Save') ?>
                </button>
                <!-- /Update Button -->
            </div>
        </div>
        </form>
           <!-- /dark theme color style -->

        <!-- color style setting for dark theme -->
        <form x-show="panelOpened" class="lw-ajax-form lw-form" data-show-processing="true" method="post" action="{{ route('manage.configuration.write', ['pageType' => 'application_dark_theme_styles_and_colors']) }}" x-data="{
            @foreach ($darkThemeAppColorStyles as $styleItem)
            '{{ $styleItem['key'] }}':'{{ getAppSettings($styleItem['key']) }}',
            @endforeach
        }">
            <input type="hidden" name="pageType" value="application_dark_theme_styles_and_colors">
            <hr class="my-3">
            <div class="row">
                <div class="col">
                    <h2>{{  __tr('Choose your colors for dark theme') }}</h2>
                </div>
            </div>
            <div class="row">
            @foreach ($darkThemeAppColorStyles as $styleItem)
            @if (in_array($styleItem['key'], $skipItems))
                @continue
            @endif
            <x-lw.input-field data-form-group-class="col-xl-2 col-lg-3 col-sm-6 col-md-6" type="color" x-model="{{ $styleItem['key'] }}" :label="$styleItem['title']" data-default="{{ $styleItem['default'] }}" name="{{ $styleItem['key'] }}" required />
            @endforeach
        </div>
        <div class="row">
            <!-- /Sidebar color on Store Front -->
            <div class="col-12 text-right clear mt-3">
                <button type="button" @click="__DataRequest.updateModels({@foreach ($darkThemeAppColorStyles as $styleItem)'{{ $styleItem['key'] }}':'{{ $styleItem['default'] }}',@endforeach});" class="btn btn-secondary lw-btn-block-mobile">
                    <?= __tr('Reset to Default') ?>
                </button>
                <!-- Update Button -->
                <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">
                    <?= __tr('Save') ?>
                </button>
                <!-- /Update Button -->
            </div>
        </div>
        </form>
         <!-- /color style setting for dark theme -->
    </fieldset>
     <!-- Head code block -->
    <fieldset x-data="{panelOpened:false}" x-cloak>
        <legend @click="panelOpened = !panelOpened">{{ __tr('Head Code') }} <small class="text-muted">{{  __tr('Click to expand/collapse') }}</small></legend>
        <form  x-show="panelOpened" class="lw-ajax-form lw-form" method="post" action="<?= route('manage.configuration.write', ['pageType' => 'misc_settings']) ?>">
        <div class="alert alert-light">
            {{ __tr('You can place any script, css, styles etc. to the head tag from here. eg. script,styles tags') }}
        </div>
        <div class="mb-3 mb-sm-0">
            <label id="lwHeadCode">{{  __tr('Insert for head tag') }} </label>
            <textarea rows="10" id="lwHeadCode" class="lw-form-field form-control" placeholder="{{ __tr('You can add your required js/html code etc') }}" name="page_head_code">{!! getAppSettings('page_head_code') !!}</textarea>
        </div>
        <div class="form-group">
            <button type="submit" class="btn btn-primary btn-user lw-btn-block-mobile">{{ __tr('Save') }}</button>
        </div>
    </form>
    </fieldset>
    <!-- Head code block -->
</section>
<section class="mt-4">
    <h1>{{ __tr('Operations') }}</h1>
    <fieldset x-cloak>
        <h3>{{  __tr('It will clear many types of cache like routes, config etc') }}</h3>
        <a href="{{ route('manage.operations.clear_optimize.write') }}" class="btn btn-warning lw-ajax-link-action" data-method="post" data-confirm="{{ __tr('Are you sure you want to clear app optimizations?') }}">{{  __tr('Clear Optimizations') }}</a>
    </fieldset>
</section>