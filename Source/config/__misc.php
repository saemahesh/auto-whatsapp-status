<?php
// items which may have base values from .env as __tech etc gets assigned after translation ready
return [
    // force url to use https
    'force_https' => env('FORCE_HTTPS', false),
    /* Email Config
    ------------------------------------------------------------------------- */
    'mail_from' => [
        env('MAIL_FROM_ADD', 'your@domain.com'),
        env('MAIL_FROM_NAME', 'E-Mail Service'),
    ],
    // demos
    'demo_protected_bots' => env('DEMO_PROTECTED_BOTS', ''),
    'demo_test_recipient_contact_number' => env('DEMO_TEST_RECIPIENT_CONTACT_NUMBER', ''),
];