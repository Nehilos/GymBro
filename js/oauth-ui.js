
  function showOAuthBlockedInfo(resp) {
    // Show helpful modal and log error
    console.warn('OAuth blocked:', resp);
    document.getElementById('oauth-help-modal').classList.remove('hidden');
  }
  function closeOauthHelp(){ document.getElementById('oauth-help-modal').classList.add('hidden'); }
  