{{-- datatable queue log--}}
<x-lw.datatable lw-card-classes="border-0" data-page-length="100" id="lwCampaignQueueLog" :url="route('vendor.campaign.queue.log.list.view', ['campaignUid' => $campaignUid])">
    <th data-orderable="true" data-name="full_name">{{ __tr('Name') }}</th>
    {{-- <th data-orderable="true" data-name="last_name">{{ __tr('Last Name') }}</th> --}}
    <th data-orderable="true" data-name="phone_with_country_code">{{ __tr('Phone Number') }}</th>
    <th data-orderable="true" data-name="formatted_status">{{ __tr('Status') }}</th>
    <th data-orderable="true" data-order-by="true" data-order-type="desc" data-name="updated_at">{{ __tr('Last Status Updated at') }}</th>
    <th data-orderable="true" data-name="scheduled_at">{{ __tr('Scheduled at') }}</th>
    <th data-orderable="true" data-name="retries">{{ __tr('Auto Retried') }}</th>
    <th class="col-3 col-lg-4" data-template="#campaignActionColumnTemplate" data-name="null">{{ __tr('Messages') }}</th>
</x-lw.datatable>
 <!-- action template -->
 <script type="text/template" id="campaignActionColumnTemplate">
    <!--  status -->
    <% if (_.includes([1], __tData.status)) { %>
        <% if (__tData.whatsapp_message_error) { %>
        <span class="text-muted">{{ __tr('requeued and waiting ..') }}</span>
        <br><small class="text-danger"><%- __tData.whatsapp_message_error %></small>
        <% } else { %>
            <span class="text-muted">{{ __tr('waiting ..') }}</span>
        <% } %>
     <% } else if (__tData.status == 2) { %>
         <span class="text-danger">{{ __tr('Failed') }}</span> <br>
        <small class="text-muted"><%- __tData.whatsapp_message_error %></small>
    <% } else if (__tData.status == 3) { %>
        <span class="text-muted">{{ __tr('processing ..') }}</span>
    <% } else if (__tData.status == 4) { %>
        <span class="text-danger">{{  __tr('Processed and waiting for response') }}</span>
    <% } else if (__tData.status == 5) { %>
        <span class="text-danger">{{  __tr('Expired before processing') }}</span>
    <% } else if (__tData.status == 6) { %>
        <span class="text-danger">{{  __tr("Processed but unknown status") }}</span>
    <% } else if (__tData.status == 7) { %>
        <span class="text-danger">{{  __tr("Stopped and Aborted") }}</span>
    <% } %>
</script>
            <!-- / status -->
{{-- /datatable queue log--}}