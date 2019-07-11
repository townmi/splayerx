export const Video = {
  // error state
  ERROR_CODE_UPDATE: 'ERROR_CODE_UPDATE',
  ERROR_MESSAGE_UPDATE: 'ERROR_MESSAGE_UPDATE',
  // network state
  ID_UPDATE: 'ID_UPDATE',
  SRC_UPDATE: 'SRC_UPDATE',
  MEDIA_HASH_UPDATE: 'MEDIA_HASH_UPDATE',
  CURRENT_SRC_UPDATE: 'CURRENT_SRC_UPDATE',
  NETWORK_STATE_UPDATE: 'NETWORK_STATE_UPDATE',
  BUFFERED_UPDATE: 'BUFFERED_UPDATE',
  CAN_PLAY_TYPE_UPDATE: 'CAN_PLAY_TYPE_UPDATE',
  CROSS_ORIGIN_UPDATE: 'CROSS_ORIGIN_UPDATE',
  PRELOAD_UPDATE: 'PRELOAD_UPDATE',
  // ready state
  READY_STATE_UPDATE: 'READY_STATE_UPDATE',
  SEEKING_UPDATE: 'SEEKING_UPDATE',
  // playback state
  DURATION_UPDATE: 'DURATION_UPDATE',
  PAUSED_UPDATE: 'PAUSED_UPDATE',
  ENDED_UPDATE: 'ENDED_UPDATE',
  PLAYED_UPDATE: 'PLAYED_UPDATE',
  SEEKABLE_UPDATE: 'SEEKABLE_UPDATE',
  CURRENT_TIME_UPDATE: 'CURRENT_TIME_UPDATE',
  DEFAULT_PLAYBACK_RATE_UPDATE: 'DEFAULT_PLAYBACK_RATE_UPDATE',
  RATE_UPDATE: 'RATE_UPDATE',
  AUTOPLAY_UPDATE: 'AUTOPLAY_UPDATE',
  LOOP_UPDATE: 'LOOP_UPDATE',
  // controls
  CONTROLS_UPDATE: 'CONTROLS_UPDATE',
  VOLUME_UPDATE: 'VOLUME_UPDATE',
  MUTED_UPDATE: 'MUTED_UPDATE',
  DEFAULT_MUTED_UPDATE: 'DEFAULT_MUTED_UPDATE',
  // meta info
  INTRINSIC_WIDTH_UPDATE: 'INTRINSIC_WIDTH_UPDATE',
  INTRINSIC_HEIGHT_UPDATE: 'INTRINSIC_HEIGHT_UPDATE',
  COMPUTED_WIDTH_UPDATE: 'COMPUTED_WIDTH_UPDATE',
  COMPUTED_HEIGHT_UPDATE: 'COMPUTED_HEIGHT_UPDATE',
  RATIO_UPDATE: 'RATIO_UPDATE',
  DELAY_UPDATE: 'DELAY_UPDATE',
  // tracks
  AUDIO_TRACK_LIST_UPDATE: 'AUDIO_TRACK_LIST_UPDATE',
  VIDEO_TRACK_LIST_UPDATE: 'VIDEO_TRACK_LIST_UPDATE',
  TEXT_TRACK_LIST_UPDATE: 'TEXT_TRACK_LIST_UPDATE',
  PLAYINGLIST_RATE_UPDATE: 'PLAYINGLIST_RATE_UPDATE',
  DEFAULT_DIR_UPDATE: 'DEFAULT_DIR_UPDATE',
  SNAPSHOT_SAVED_PATH_UPDATE: 'SNAPSHOT_SAVED_PATH_UPDATE',
};

export const Subtitle = {
  LOADING_STATES_UPDATE: 'LOADING_STATE_UPDATE',
  VIDEO_SUBTITLE_MAP_UPDATE: 'VIDEO_SUBTITLE_MAP_UPDATE',
  DURATIONS_UPDATE: 'DURATIONS_UPDATE',
  NAMES_UPDATE: 'NAMES_UPDATE',
  LANGUAGES_UPDATE: 'LANGUAGES_UPDATE',
  FORMATS_UPDATE: 'FORMATS_UPDATE',
  TYPES_UPDATE: 'TYPES_UPDATE',
  RANKS_UPDATE: 'RANKS_UPDATE',
  CURRENT_FIRST_SUBTITLE_ID_UPDATE: 'CURRENT_FIRST_SUBTITLE_ID_UPDATE',
  CURRENT_SECOND_SUBTITLE_ID_UPDATE: 'CURRENT_SECOND_SUBTITLE_ID_UPDATE',
  RESET_SUBTITLES: 'RESET_SUBTITLES',
  SUBTITLE_DELAY_UPDATE: 'SUBTITLE_DELAY_UPDATE',
  SUBTITLE_SCALE_UPDATE: 'SUBTITLE_SCALE_UPDATE',
  SUBTITLE_STYLE_UPDATE: 'SUBTITLE_STYLE_UPDATE',
  SUBTITLE_SIZE_UPDATE: 'SUBTITLE_SIZE_UPDATE',
  LAST_SUBTITLE_SIZE_UPDATE: 'LAST_SUBTITLE_SIZE_UPDATE',
  NO_SUBTITLE_UPDATE: 'NO_SUBTITLE_UPDATE',
  SUBTITLE_TOP_UPDATE: 'SUBTITLE_TOP_UPDATE',
  CURRENT_SUBTITLE_REMOVE: 'CURRENT_SUBTITLE_REMOVE',
  SUBTITLE_TYPE_UPDATE: 'SUBTITLE_TYPE_UPDATE',
  SECONDARY_SUBTITLE_ENABLED_UPDATE: 'SECONDARY_SUBTITLE_ENABLED_UPDATE',
  SUBTITLE_SETTINGS_TYPE_UPDATE: 'SUBTITLE_SETTINGS_TYPE_UPDATE',
};

export const newSubtitle = {
  setModuleId: 'SET_MODULE_ID',
  setSource: 'SET_SOURCE',
  setType: 'SET_TYPE',
  setFormat: 'SET_FORMAT',
  setLanguage: 'SET_LANGUAGE',
  setDelay: 'SET_DELAY',
  setPlayedTime: 'SET_PLAYED_TIME',
  setHash: 'SET_HASH',
};

export const SubtitleManager = {
  setPrimarySubtitleId: 'SET_PRIMARY_SUBTITLE_ID',
  setSecondarySubtitleId: 'SET_PSECONDARY_SUBTITLE_ID',
  setPlaylistId: 'SET_PLAYLIST_ID',
  setMediaItemId: 'SET_MEDIA_ITEM_ID',
  setIsRefreshing: 'SET_IS_REFRESHING',
  addSubtitleId: 'ADD_SUBTITLE_ID',
  deleteSubtitleId: 'DELETE_SUBTITLE_ID',
  setGlobalDelay: 'SET_GLOBAL_DELAY',
};

export const Input = {
  MOUSEMOVE_CLIENT_POSITION_UPDATE: 'MOUSEMOVE_CLIENT_POSITION_UPDATE',
  MOUSEMOVE_COMPONENT_NAME_UPDATE: 'MOUSEMOVE_COMPONENT_NAME_UPDATE',
  PRESSED_MOUSE_BUTTON_NAMES_UPDATE: 'PRESSED_MOUSE_BUTTON_NAMES_UPDATE',
  MOUSEDOWN_COMPONENT_NAME_UPDATE: 'MOUSEDOWN_COMPONENT_NAME_UPDATE',
  MOUSEUP_COMPONENT_NAME_UPDATE: 'MOUSEUP_COMPONENT_NAME_UPDATE',
  PRESSED_KEYBOARD_CODES_UPDATE: 'PRESSED_KEYBOARD_CODES_UPDATE',
  WHEEL_COMPONENT_NAME_UPDATE: 'WHEEL_COMPONENT_NAME_UPDATE',
  WHEEL_TIMESTAMP_UPDATE: 'WHEEL_TIMESTAMP_UPDATE',
  WHEEL_DIRECTION_UPDATE: 'WHEEL_DIRECTION_UPDATE',
};
