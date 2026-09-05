!macro preInit
  !ifndef BUILD_UNINSTALLER
    SetSilent silent
    InitPluginsDir
    File /oname=$PLUGINSDIR\splash.bmp "${PROJECT_DIR}\resources\installer-splash.bmp"
    AdvSplash::show 1600 350 350 -1 "$PLUGINSDIR\splash"
    Pop $0
  !endif
!macroend
