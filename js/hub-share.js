/**
 * WC hub — floating share button + network dropdown (English).
 */
(function () {
  'use strict';

  var SITE = 'https://pashavleon.github.io/vote/';
  var PAGE_URLS = {
    home: SITE,
    winner: SITE + 'winner.html',
    matches: SITE + 'matches.html',
    arch: SITE + 'arch.html',
  };

  var lastVote = null;
  var widgetEl = null;
  var panelOpen = false;

  var ICONS = {
    native: '<path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>',
    x: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    facebook: '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
    whatsapp: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',
    telegram: '<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>',
    linkedin: '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
    threads: '<path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.19.408-2.285 1.33-3.083.88-.76 2.119-1.207 3.583-1.291.927-.054 1.79.002 2.606.166-.112-.96-.4-1.716-.86-2.257-.705-.83-1.84-1.25-3.372-1.25-1.29 0-2.364.41-3.096 1.21-.63.69-.96 1.64-.98 2.82l-2.048-.144c.03-1.62.563-2.99 1.583-4.07 1.03-1.09 2.49-1.67 4.34-1.67 2.19 0 3.84.67 4.91 1.99 1.03 1.25 1.55 3.05 1.55 5.35 0 .17-.01.34-.02.51 1.25.73 2.18 1.73 2.72 2.97.74 1.71.78 4.02-1.14 5.9-1.77 1.73-4.1 2.56-7.38 2.58z"/>',
    bluesky: '<path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.886-2.834 10.21 5.016 7.19 6.871-1.555 7.787-5.995.916 4.44 2.357 13.106 7.788 5.995 4.39-6.32 1.033-9.63-2.86-10.21-.139-.016-.277-.034-.415-.056.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>',
    reddit: '<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.247.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>',
    vk: '<path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.203.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.271.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>',
    pinterest: '<path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.719-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>',
    messenger: '<path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.09.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.13 3.26L19.752 8.1l-6.561 6.863z"/>',
    line: '<path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>',
    viber: '<path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.177.528 6.55.514 9.521c-.013 2.97-.078 8.546 5.014 10.033l-.004 2.416s-.037.98.61 1.177c.777.24 1.234-.5 1.976-1.303.407-.44.972-1.084 1.396-1.574 3.85.323 6.812-1.73 7.15-1.96 3.786-2.794 5.62-6.76 5.726-11.89.106-5.13-3.05-9.077-3.05-9.077S17.378.026 11.398.002zm.316 2.296c4.478-.043 7.447 2.81 7.88 3.24.002 0 2.755 3.406 2.67 7.865-.085 4.46-1.637 7.612-4.87 10.07-.05.04-2.896 2.276-6.17 2.04 0 0-2.438 2.94-3.2 3.69-.12.12-.26.17-.35.15-.13-.03-.17-.19-.17-.37l.01-4.17C2.76 18.305 2.82 13.55 2.83 9.65c.01-2.47.65-4.45 2.05-5.85 1.97-1.82 5.36-2.07 6.81-2.11l.324-.002z"/>',
    snapchat: '<path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.041.751.075.301.24.513.435.633.24.149.509.179.689.179.165 0.301-.015.435-.09.149-.074.301-.24.405-.435.165-.254.24-.435.27-.509h.015c.045-.135.165-.479.555-.479h.015c.299 0 .509.195.509.509 0 .435-.27.958-.75 1.378-.435.405-1.018.615-1.648.615-.359 0-.72-.075-1.05-.225-.24-.104-.465-.27-.66-.479-.255-.24-.435-.555-.51-.899-.06-.24-.09-.479-.09-.719 0-.24.015-.479.045-.719-.24-.24-.555-.555-.899-.899-.24-.24-.479-.435-.719-.555-.24-.12-.479-.18-.719-.18-.24 0-.479.06-.719.18-.24.12-.479.315-.719.555-.344.344-.659.659-.899.899-.03.24-.045.479-.045.719 0 .24.03.479.09.719.075.344.255.659.51.899.195.209.42.375.66.479.33.15.69.225 1.05.225.63 0 1.213-.21 1.648-.615.48-.42.75-.943.75-1.378 0-.314-.21-.509-.509-.509h-.015c-.39 0-.51.344-.555.479-.03.074-.105.255-.27.509-.105.195-.27.36-.435.435-.134.075-.27.09-.435.09-.18 0-.449-.03-.689-.179-.195-.12-.36-.332-.435-.633-.079-.376-.018-.66.041-.751-1.873-.283-2.906-.702-3.146-1.271-.03-.075-.045-.15-.045-.225-.015-.24.165-.465.42-.509 3.265-.539 4.731-3.878 4.791-4.014l.015-.015c.18-.344.21-.644.12-.868-.194-.45-.883-.675-1.333-.81-.135-.044-.255-.09-.344-.119-.823-.329-1.228-.719-1.213-1.168 0-.359.285-.689.734-.838.15-.061.327-.09.509-.09.12 0 .299.016.464.104.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847 1.583-3.545 4.94-3.821 5.93-3.821z"/>',
    email: '<path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
    copy: '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>',
  };

  var NETWORKS = [
    { id: 'native', label: 'Share…', type: 'native', mod: 'native', hideDesktop: false },
    { id: 'x', label: 'X', type: 'link', mod: 'x' },
    { id: 'facebook', label: 'Facebook', type: 'link', mod: 'facebook' },
    { id: 'whatsapp', label: 'WhatsApp', type: 'link', mod: 'whatsapp' },
    { id: 'telegram', label: 'Telegram', type: 'link', mod: 'telegram' },
    { id: 'instagram', label: 'Instagram', type: 'copy', mod: 'instagram', copyHint: 'Copied — paste in Instagram Story, DM, or bio' },
    { id: 'threads', label: 'Threads', type: 'link', mod: 'threads' },
    { id: 'bluesky', label: 'Bluesky', type: 'link', mod: 'bluesky' },
    { id: 'linkedin', label: 'LinkedIn', type: 'link', mod: 'linkedin' },
    { id: 'reddit', label: 'Reddit', type: 'link', mod: 'reddit' },
    { id: 'pinterest', label: 'Pinterest', type: 'link', mod: 'pinterest' },
    { id: 'messenger', label: 'Messenger', type: 'messenger', mod: 'messenger' },
    { id: 'vk', label: 'VK', type: 'link', mod: 'vk' },
    { id: 'line', label: 'LINE', type: 'link', mod: 'line' },
    { id: 'viber', label: 'Viber', type: 'link', mod: 'viber' },
    { id: 'snapchat', label: 'Snapchat', type: 'copy', mod: 'snapchat', copyHint: 'Copied — paste in Snapchat' },
    { id: 'email', label: 'Email', type: 'link', mod: 'email' },
    { id: 'copy', label: 'Copy link', type: 'copy', mod: 'copy', copyHint: 'Link copied!' },
  ];

  function getPage() {
    var page = document.body.getAttribute('data-page');
    if (page && PAGE_URLS[page]) return page;
    return 'home';
  }

  function getChoiceLabel(choiceId) {
    if (!choiceId) return null;
    var card = document.querySelector('[data-winner-choice="' + choiceId + '"] .team-card__name');
    if (card) return card.textContent.trim();
    var chip = document.querySelector('[data-match-vote="' + choiceId + '"] .vote-chip__name');
    if (chip) return chip.textContent.trim();
    return choiceId.toUpperCase();
  }

  function buildText() {
    var page = getPage();
    var url = PAGE_URLS[page];
    var api = window.VoteApi;
    var winnerId = api && api.getStoredChoice ? api.getStoredChoice('wc-2026-winner') : null;
    var winnerLabel = winnerId ? getChoiceLabel(winnerId) : null;

    if (lastVote && lastVote.label && page === 'matches') {
      return 'I picked ' + lastVote.label + ' in this World Cup 2026 match fan poll — vote too:';
    }
    if (page === 'winner' && winnerLabel) {
      return 'I voted ' + winnerLabel + ' to win World Cup 2026 — join the fan poll:';
    }
    if (page === 'matches') {
      return 'Predict every World Cup 2026 group-stage match — live fan poll:';
    }
    if (page === 'winner') {
      return 'Who will win World Cup 2026? Vote in this live fan poll (48 teams):';
    }
    if (page === 'arch') {
      return 'FanVote archive — World Cup 2026 & UCL fan polls:';
    }
    return 'World Cup 2026 fan poll — vote the winner and predict every match:';
  }

  function buildPayload() {
    var page = getPage();
    var text = buildText();
    var url = PAGE_URLS[page];
    return {
      text: text,
      url: url,
      full: text + '\n' + url,
      encUrl: encodeURIComponent(url),
      encText: encodeURIComponent(text),
      encFull: encodeURIComponent(text + ' ' + url),
      encSubject: encodeURIComponent('World Cup 2026 fan poll'),
    };
  }

  function networkUrl(id, p) {
    switch (id) {
      case 'x':
        return 'https://twitter.com/intent/tweet?text=' + p.encText + '&url=' + p.encUrl;
      case 'facebook':
        return 'https://www.facebook.com/sharer/sharer.php?u=' + p.encUrl;
      case 'whatsapp':
        return 'https://wa.me/?text=' + p.encFull;
      case 'telegram':
        return 'https://t.me/share/url?url=' + p.encUrl + '&text=' + p.encText;
      case 'linkedin':
        return 'https://www.linkedin.com/sharing/share-offsite/?url=' + p.encUrl;
      case 'threads':
        return 'https://www.threads.net/intent/post?text=' + p.encFull;
      case 'bluesky':
        return 'https://bsky.app/intent/compose?text=' + p.encFull;
      case 'reddit':
        return 'https://www.reddit.com/submit?url=' + p.encUrl + '&title=' + p.encText;
      case 'pinterest':
        return 'https://pinterest.com/pin/create/button/?url=' + p.encUrl + '&description=' + p.encText;
      case 'vk':
        return 'https://vk.com/share.php?url=' + p.encUrl + '&title=' + p.encText;
      case 'line':
        return 'https://social-plugins.line.me/lineit/share?url=' + p.encUrl;
      case 'viber':
        return 'viber://forward?text=' + p.encFull;
      case 'email':
        return 'mailto:?subject=' + p.encSubject + '&body=' + p.encFull;
      case 'messenger':
        return 'fb-messenger://share?link=' + p.encUrl;
      default:
        return '#';
    }
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text, done);
      });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (done) done();
    } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function showFeedback(msg) {
    if (!widgetEl) return;
    var el = widgetEl.querySelector('[data-hub-share-feedback]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(widgetEl._feedbackTimer);
    widgetEl._feedbackTimer = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function closePanel() {
    if (!widgetEl) return;
    panelOpen = false;
    var panel = widgetEl.querySelector('.hub-share__panel');
    var fab = widgetEl.querySelector('.hub-share__fab');
    if (panel) panel.hidden = true;
    if (fab) fab.setAttribute('aria-expanded', 'false');
  }

  function openPanel() {
    if (!widgetEl) return;
    panelOpen = true;
    var panel = widgetEl.querySelector('.hub-share__panel');
    var fab = widgetEl.querySelector('.hub-share__fab');
    if (panel) panel.hidden = false;
    if (fab) fab.setAttribute('aria-expanded', 'true');
    refreshLinks();
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function refreshLinks() {
    if (!widgetEl) return;
    var p = buildPayload();
    widgetEl.querySelectorAll('[data-hub-share-network]').forEach(function (el) {
      var id = el.getAttribute('data-hub-share-network');
      if (el.tagName === 'A') {
        el.href = networkUrl(id, p);
      }
    });
  }

  function handleNetworkClick(id, net) {
    var p = buildPayload();
    if (net.type === 'native') {
      if (navigator.share) {
        navigator.share({ title: 'FanVote — World Cup 2026', text: p.text, url: p.url }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          copyText(p.full, function () { showFeedback('Link copied!'); });
        });
      }
      return;
    }
    if (net.type === 'copy') {
      copyText(p.full, function () {
        showFeedback(net.copyHint || 'Copied!');
      });
      closePanel();
      return;
    }
    if (net.type === 'messenger') {
      var href = networkUrl('messenger', p);
      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = href;
      } else {
        copyText(p.full, function () {
          showFeedback('Copied — paste in Messenger');
        });
      }
      closePanel();
      return;
    }
    if (net.type === 'link' && id === 'viber') {
      window.location.href = networkUrl(id, p);
      closePanel();
      return;
    }
    closePanel();
  }

  function svgIcon(name) {
    var path = ICONS[name] || ICONS.copy;
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' + path + '</svg>';
  }

  function buildWidget() {
    var items = NETWORKS.map(function (net) {
      if (net.type === 'native' && !navigator.share) return '';
      var tag = net.type === 'link' ? 'a' : 'button';
      var extra = net.type === 'link'
        ? ' href="#" target="_blank" rel="noopener noreferrer"'
        : ' type="button"';
      return (
        '<' + tag + ' class="hub-share__item hub-share__item--' + net.mod + '"' + extra +
        ' data-hub-share-network="' + net.id + '" aria-label="Share on ' + net.label + '">' +
        svgIcon(net.mod === 'copy' ? 'copy' : net.mod) +
        '<span>' + net.label + '</span>' +
        '</' + tag + '>'
      );
    }).join('');

    var el = document.createElement('aside');
    el.className = 'hub-share';
    el.setAttribute('aria-label', 'Share this poll');
    el.innerHTML =
      '<button type="button" class="hub-share__fab" aria-expanded="false" aria-haspopup="true" aria-label="Share">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
          '<polyline points="16 6 12 2 8 6"/>' +
          '<line x1="12" y1="2" x2="12" y2="15"/>' +
        '</svg>' +
      '</button>' +
      '<div class="hub-share__panel" hidden role="menu">' +
        '<p class="hub-share__panel-title">Share FanVote</p>' +
        '<div class="hub-share__grid" role="none">' + items + '</div>' +
        '<p class="hub-share__feedback" data-hub-share-feedback hidden></p>' +
      '</div>';
    document.body.appendChild(el);

    el.querySelector('.hub-share__fab').addEventListener('click', function (e) {
      e.stopPropagation();
      togglePanel();
    });

    NETWORKS.forEach(function (net) {
      if (net.type === 'native' && !navigator.share) return;
      var btn = el.querySelector('[data-hub-share-network="' + net.id + '"]');
      if (!btn) return;
      if (net.type === 'link') {
        btn.addEventListener('click', function () { closePanel(); });
      } else {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          handleNetworkClick(net.id, net);
        });
      }
    });

    document.addEventListener('click', function (e) {
      if (!panelOpen || !widgetEl) return;
      if (!widgetEl.contains(e.target)) closePanel();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panelOpen) closePanel();
    });

    widgetEl = el;
    refreshLinks();
  }

  function init() {
    var page = document.body.getAttribute('data-page');
    if (!page || page === 'ucl') return;
    if (!PAGE_URLS[page] && page !== 'home') {
      if (!document.body.hasAttribute('data-page')) return;
    }
    buildWidget();

    document.addEventListener('fan-vote-cast', function (e) {
      var d = e.detail || {};
      lastVote = {
        pollId: d.pollId,
        choice: d.choice,
        label: d.label || getChoiceLabel(d.choice),
        matchTitle: d.matchTitle || '',
      };
      refreshLinks();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
