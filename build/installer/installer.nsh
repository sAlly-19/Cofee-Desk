; Personalização de marca. Mantém as rotinas padrão de instalação e atualização.
!define MUI_FONT "Segoe UI"
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao Coffee Desk"
!define MUI_WELCOMEPAGE_TEXT "Sua próxima conexão começa aqui.$\r$\n$\r$\nEste assistente instalará o Coffee Desk no seu computador.$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_TITLE "Coffee Desk pronto para usar"
!define MUI_FINISHPAGE_TEXT "A instalação foi concluída.$\r$\n$\r$\nAbra o Coffee Desk para iniciar uma conexão ou disponibilizar este computador para acesso remoto."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o Coffee Desk"
!define MUI_UNWELCOMEPAGE_TITLE "Desinstalar o Coffee Desk"
!define MUI_UNWELCOMEPAGE_TEXT "Este assistente removerá o Coffee Desk deste computador."
!macro customHeader
  BrandingText "Café - Sistemas && Softwares"
!macroend
!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !insertmacro MUI_PAGE_WELCOME
!macroend
