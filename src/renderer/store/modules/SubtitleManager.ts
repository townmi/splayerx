/* eslint-disable @typescript-eslint/no-explicit-any */
import uuidv4 from 'uuid/v4';
import {
  isEqual, get, sortBy, differenceWith, flatten, remove, debounce,
} from 'lodash';
import Vue from 'vue';
import { extname } from 'path';
import { existsSync } from 'fs';
import store from '@/store';
import { SubtitleManager as m } from '@/store/mutationTypes';
import { SubtitleManager as a, newSubtitle as subActions, Subtitle as legacyActions } from '@/store/actionTypes';
import {
  SubtitleControlListItem, Type, IEntityGenerator, Entity,
} from '@/interfaces/ISubtitle';
import {
  TranscriptInfo,
  searchForLocalList, retrieveEmbeddedList, fetchOnlineList,
  OnlineGenerator, LocalGenerator, EmbeddedGenerator,
} from '@/services/subtitle';
import { generateHints, calculatedName } from '@/libs/utils';
import { log } from '@/libs/Log';
import SubtitleModule from './Subtitle';
import { IStoredSubtitleItem, SelectedSubtitle } from '@/interfaces/ISubtitleStorage';
import {
  retrieveSubtitlePreference, DatabaseGenerator,
  storeSubtitleLanguage, addSubtitleItemsToList, removeSubtitleItemsFromList,
  storeSelectedSubtitles, updateSubtitleList,
} from '@/services/storage/subtitle';
import { addBubble } from '../../helpers/notificationControl';
import {
  ONLINE_LOADING, REQUEST_TIMEOUT,
  SUBTITLE_UPLOAD, UPLOAD_SUCCESS, UPLOAD_FAILED,
  LOCAL_SUBTITLE_REMOVED,
} from '../../helpers/notificationcodes';
import { LanguageCode } from '@/libs/language';
import { ISubtitleStream } from '@/plugins/mediaTasks';

const sortOfTypes = {
  local: 0,
  embedded: 1,
  online: 2,
};

let unwatch: Function;

type SubtitleManagerState = {
  mediaHash: string,
  primarySubtitleId: string,
  secondarySubtitleId: string,
  isRefreshing: boolean,
  allSubtitles: { [id: string]: SubtitleControlListItem },
  primaryDelay: number,
  secondaryDelay: number,
}
const state = {
  mediaHash: '',
  primarySubtitleId: '',
  secondarySubtitleId: '',
  isRefreshing: false,
  allSubtitles: {},
  primaryDelay: 0,
  secondaryDelay: 0,
};
const getters = {
  list(state: SubtitleManagerState) {
    const list = Object.values(state.allSubtitles).filter(v => !!v);
    return sortBy(list, (sub: SubtitleControlListItem) => {
      if (sub.type === Type.Online && sub.language !== store.getters.primaryLanguage) {
        return sortOfTypes[sub.type] + 1;
      }
      return sortOfTypes[sub.type];
    }).map((sub: SubtitleControlListItem) => ({
      ...sub,
      name: calculatedName(sub, list),
    }));
  },
  primarySubtitleId(state: SubtitleManagerState): string { return state.primarySubtitleId; },
  secondarySubtitleId(state: SubtitleManagerState): string { return state.secondarySubtitleId; },
  isRefreshing(state: SubtitleManagerState): boolean { return state.isRefreshing; },
  ableToPushCurrentSubtitle(state: SubtitleManagerState): boolean {
    let enable = false;
    if (state.primarySubtitleId || state.secondarySubtitleId) {
      enable = true;
    }
    return enable;
  },
  primaryDelay({ primaryDelay }: SubtitleManagerState) { return primaryDelay; },
  secondaryDelay({ secondaryDelay }: SubtitleManagerState) { return secondaryDelay; },
  calculatedNoSub(state: SubtitleManagerState, { list }: any) { return !list.length; },
};
const mutations = {
  [m.setMediaHash](state: SubtitleManagerState, hash: string) {
    state.mediaHash = hash;
  },
  [m.setPrimarySubtitleId](state: SubtitleManagerState, id: string) {
    state.primarySubtitleId = id;
  },
  [m.setSecondarySubtitleId](state: SubtitleManagerState, id: string) {
    state.secondarySubtitleId = id;
  },
  [m.setIsRefreshing](state: SubtitleManagerState, isRefreshing: boolean) {
    state.isRefreshing = isRefreshing;
  },
  [m.addSubtitleId](state: SubtitleManagerState, controlItem: SubtitleControlListItem) {
    const { id } = controlItem;
    Vue.set(state.allSubtitles, id, controlItem);
    const { primarySubtitleId, secondarySubtitleId } = state;
    if (primarySubtitleId && !state.allSubtitles[primarySubtitleId]) state.primarySubtitleId = '';
    if (secondarySubtitleId && !state.allSubtitles[secondarySubtitleId]) state.secondarySubtitleId = '';
  },
  [m.deleteSubtitleId](state: SubtitleManagerState, id: string) {
    Vue.set(state.allSubtitles, id, undefined);
  },
  [m.deletaAllSubtitleIds](state: SubtitleManagerState) { state.allSubtitles = {}; },
  [m.setPrimaryDelay](state: SubtitleManagerState, delayInSeconds: number) {
    state.primaryDelay = delayInSeconds;
    const subtitle = state.allSubtitles[state.primarySubtitleId];
    if (subtitle) subtitle.delay = delayInSeconds;
  },
  [m.setSecondaryDelay](state: SubtitleManagerState, delayInSeconds: number) {
    state.secondaryDelay = delayInSeconds;
    const subtitle = state.allSubtitles[state.secondarySubtitleId];
    if (subtitle) subtitle.delay = delayInSeconds;
  },
};
interface IAddSubtitlesOptions<SourceType> {
  mediaHash: string,
  source: SourceType[];
}
interface IAddDatabaseSubtitlesOptions extends IAddSubtitlesOptions<IStoredSubtitleItem> {
  selected?: {
    primary?: SelectedSubtitle;
    secondary?: SelectedSubtitle;
  };
}
interface IAddSubtitleOptions {
  generator: IEntityGenerator;
  mediaHash: string;
}
function privacyConfirm(): Promise<boolean> {
  const { $bus } = Vue.prototype;
  $bus.$emit('privacy-confirm');
  return new Promise((resolve) => {
    $bus.$once('subtitle-refresh-continue', resolve);
  });
}

let primarySelectionComplete = false;
let secondarySelectionComplete = false;
let alterDelayTimeoutId: NodeJS.Timer;
function setDelayTimeout() {
  clearTimeout(alterDelayTimeoutId);
  alterDelayTimeoutId = setTimeout(() => store.dispatch(a.storeSubtitleDelays), 10000);
}
function fetchOnlineListWithBubble(
  videoSrc: string,
  languageCode: LanguageCode,
  hints?: string,
): Promise<TranscriptInfo[]> {
  let results: TranscriptInfo[] = [];
  return new Promise(async (resolve) => {
    const onlineTimeoutId = setTimeout(() => {
      resolve(results);
      addBubble(REQUEST_TIMEOUT, { id: `fetchOnlineListWithBubble-${videoSrc}` });
    }, 10000);
    try {
      results = await fetchOnlineList(videoSrc, languageCode, hints);
    } catch (err) {
      results = [];
    } finally {
      resolve(results);
      clearTimeout(onlineTimeoutId);
    }
  });
}
function initializeManager({ getters, commit, dispatch }: any) {
  const list = getters.list as SubtitleControlListItem[];
  list.forEach(s => dispatch(a.removeSubtitle, s.id));
  commit(m.setMediaHash, getters.mediaHash);
  dispatch(a.refreshSubtitlesInitially);
}
const debouncedInitializeManager = debounce(initializeManager, 1000);
const actions = {
  async [a.initializeManager](context: any) {
    debouncedInitializeManager(context);
  },
  [a.resetManager]({ commit }: any) {
    commit(m.setMediaHash, '');
    commit(m.setPrimarySubtitleId, '');
    commit(m.setSecondarySubtitleId, '');
    commit(m.setIsRefreshing, false);
    commit(m.deletaAllSubtitleIds);
    primarySelectionComplete = false;
    secondarySelectionComplete = false;
  },
  async [a.refreshSubtitlesInitially]({
    state, getters, dispatch, commit,
  }: any) {
    primarySelectionComplete = false;
    secondarySelectionComplete = false;
    commit(m.setIsRefreshing, true);
    dispatch(a.startAISelection);

    const {
      primaryLanguage, secondaryLanguage,
      originSrc,
      privacyAgreement,
    } = getters;
    const { mediaHash } = state;
    const list = getters.list as SubtitleControlListItem[];
    const preference = await retrieveSubtitlePreference(state.mediaHash);
    const hasStoredSubtitles = !!preference && !!preference.list.length;
    const languageHasChanged = (
      !preference
      || !!differenceWith(
        Object.values(preference.language),
        [primaryLanguage, secondaryLanguage],
      ).length
    );

    if (hasStoredSubtitles && !languageHasChanged && preference) {
      return Promise.race([
        dispatch(a.addDatabaseSubtitles, {
          source: preference.list,
          selected: preference.selected,
          mediaHash: state.mediaHash,
        }),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
      ])
        .catch(console.error)
        .finally(() => {
          commit(m.setIsRefreshing, false);
          dispatch(legacyActions.UPDATE_SUBTITLE_TYPE, true);
          dispatch(a.stopAISelection);
        });
    }

    if (hasStoredSubtitles && preference) {
      await dispatch(a.addDatabaseSubtitles, {
        storedList: preference.list,
        selected: preference.selected,
        mediaHash: state.mediaHash,
      });
    }

    let onlinePromise = Promise.resolve();
    /** whether or not to refresh online subtitles */
    const onlineNeeded = (languageHasChanged || !hasStoredSubtitles) && ['mkv', 'avi', 'ts', 'mp4'].includes(extname(originSrc).slice(1)) && privacyAgreement;
    if (onlineNeeded) {
      onlinePromise = dispatch(a.refreshOnlineSubtitles, { mediaHash, bubble: false });
    }
    /** whether or not to refresh embedded subtitles */
    const embeddedNeeded = !list
      .some(({ type }: SubtitleControlListItem) => type === Type.Embedded);
    if (embeddedNeeded) {
      retrieveEmbeddedList(originSrc)
        .then(streams => dispatch(a.addEmbeddedSubtitles, { mediaHash, source: streams }));
    }

    return Promise.race([
      Promise.all([
        onlinePromise,
        dispatch(a.addLocalSubtitles, {
          mediaHash,
          source: await searchForLocalList(originSrc),
        }),
      ]),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ])
      .catch(console.error)
      .finally(() => {
        dispatch(a.stopAISelection);
        storeSubtitleLanguage([primaryLanguage, secondaryLanguage], state.mediaHash);
        dispatch(a.checkLocalSubtitles);
        dispatch(a.checkSubtitleList);
        commit(m.setIsRefreshing, false);
        dispatch(legacyActions.UPDATE_SUBTITLE_TYPE, true);
      });
  },
  async [a.refreshSubtitles]({
    state, getters, dispatch, commit,
  }: any) {
    const {
      originSrc,
      primaryLanguage, secondaryLanguage,
      privacyAgreement,
    } = getters;
    const { mediaHash } = state;

    primarySelectionComplete = false;
    secondarySelectionComplete = false;
    commit(m.setIsRefreshing, true);
    dispatch(a.startAISelection);
    const onlineNeeded = privacyAgreement ? true : await privacyConfirm();
    const onlinePromise = onlineNeeded
      ? dispatch(a.refreshOnlineSubtitles, { mediaHash, bubble: true })
      : Promise.resolve();
    return Promise.race([
      Promise.all([
        onlinePromise,
        dispatch(a.addLocalSubtitles, await searchForLocalList(originSrc)),
      ]),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ])
      .catch(console.error)
      .finally(() => {
        dispatch(a.stopAISelection);
        storeSubtitleLanguage([primaryLanguage, secondaryLanguage], mediaHash);
        dispatch(a.checkLocalSubtitles);
        dispatch(a.checkSubtitleList);
        commit(m.setIsRefreshing, false);
        dispatch(legacyActions.UPDATE_SUBTITLE_TYPE, true);
      });
  },
  async [a.refreshOnlineSubtitles](
    { getters, dispatch }: any,
    { mediaHash, bubble }: { mediaHash: string, bubble: boolean },
  ) {
    const {
      originSrc,
      primaryLanguage, secondaryLanguage,
    } = getters;
    if (bubble) addBubble(ONLINE_LOADING);
    const hints = generateHints(originSrc);
    return Promise.all(bubble ? [
      fetchOnlineListWithBubble(originSrc, primaryLanguage, hints),
      fetchOnlineListWithBubble(originSrc, secondaryLanguage, hints),
    ] : [
      fetchOnlineList(originSrc, primaryLanguage, hints),
      fetchOnlineList(originSrc, secondaryLanguage, hints),
    ]).then((resultsList) => {
      const results = flatten(resultsList);
      const newSubtitlesToAdd: TranscriptInfo[] = [];
      const oldSubtitlesToDel: SubtitleControlListItem[] = [];
      const oldSubtitles = [...(getters as { list: SubtitleControlListItem[] }).list];
      // delete subtitles not matching the current language preference
      const wrongLanguageSubs = remove(
        oldSubtitles,
        ({ type, language }) => (
          type === Type.Online
          && language !== primaryLanguage
          && language !== secondaryLanguage
        ),
      );
      // delete subtitles not existed in the new subtitles
      const notExistedOldSubs = remove(
        oldSubtitles,
        ({ type, hash }) => (
          type === Type.Online
          && !results.find(({ transcriptIdentity }) => transcriptIdentity === hash)
        ),
      );
      oldSubtitlesToDel.push(...wrongLanguageSubs, ...notExistedOldSubs);
      // add subtitles not existed in the old subtitles
      const notExistedNewSubs = results
        .filter(({ transcriptIdentity }) => !oldSubtitles
          .find(({ id }) => id === transcriptIdentity));
      newSubtitlesToAdd.push(...notExistedNewSubs);
      return { delete: oldSubtitlesToDel, add: newSubtitlesToAdd };
    }).then(result => dispatch(a.addOnlineSubtitles, { mediaHash, source: result.add })
      .then(() => dispatch(a.deleteSubtitlesByUuid, result.delete)));
  },
  [a.checkLocalSubtitles]({ dispatch, getters }: any) {
    const list = getters.list as SubtitleControlListItem[];
    const localInvalidSubtitles = list
      .filter(({ type, source }) => type === Type.Local && !existsSync(source as string));
    if (localInvalidSubtitles.length) {
      dispatch(a.deleteSubtitlesByUuid, localInvalidSubtitles)
        .then(() => addBubble(LOCAL_SUBTITLE_REMOVED));
    }
  },
  async [a.addLocalSubtitles](
    { dispatch }: any,
    { mediaHash, source }: IAddSubtitlesOptions<string>,
  ) {
    return Promise.all(
      source.map((path: string) => dispatch(a.addSubtitle, {
        generator: new LocalGenerator(path),
        mediaHash,
      })),
    ).then(subtitles => addSubtitleItemsToList(subtitles, mediaHash));
  },
  async [a.addLocalSubtitlesWithSelect]({ state, dispatch, getters }: any, paths: string[]) {
    let selectedHash = paths[0];
    const { mediaHash } = state;
    const list = getters.list as SubtitleControlListItem[];
    // tempoary solution, need db validation schema to ensure data consistent
    if (mediaHash) {
      return Promise.all(
        paths.map(async (path: string, i: number) => {
          const g = new LocalGenerator(path);
          if (i === 0) {
            try {
              selectedHash = await g.getHash();
            } catch (ex) { console.error(ex); }
          }
          return dispatch(a.addSubtitle, {
            generator: g,
            mediaHash,
          });
        }),
      ).then((localEntities: SubtitleControlListItem[]) => {
        addSubtitleItemsToList(localEntities, state.mediaHash);
        const sub = list.find((sub: SubtitleControlListItem) => sub.hash === selectedHash);
        if (sub && getters.isFirstSubtitle) {
          dispatch(a.changePrimarySubtitle, sub.id);
        } else if (sub && !getters.isFirstSubtitle) {
          dispatch(a.changeSecondarySubtitle, sub.id);
        }
      });
    }
    return {};
  },
  async [a.addEmbeddedSubtitles](
    { dispatch }: any,
    { mediaHash, source }: IAddSubtitlesOptions<[string, ISubtitleStream]>,
  ) {
    return Promise.all(
      source.map(stream => dispatch(a.addSubtitle, {
        generator: new EmbeddedGenerator(stream[0], stream[1]),
        mediaHash,
      })),
    ).then(subtitles => addSubtitleItemsToList(subtitles, mediaHash));
  },
  async [a.addOnlineSubtitles](
    { dispatch }: any,
    { mediaHash, source }: IAddSubtitlesOptions<TranscriptInfo>,
  ) {
    return Promise.all(
      source.map((info: TranscriptInfo) => dispatch(a.addSubtitle, {
        generator: new OnlineGenerator(info),
        mediaHash,
      })),
    ).then(subtitles => addSubtitleItemsToList(subtitles, mediaHash));
  },
  async [a.addDatabaseSubtitles](
    { getters, dispatch }: any,
    { source, mediaHash, selected }: IAddDatabaseSubtitlesOptions,
  ) {
    return Promise.all(
      source.map(async stored => dispatch(a.addSubtitle, {
        generator: await DatabaseGenerator.from(stored),
        mediaHash,
      })),
    )
      .then(() => {
        const { list } = getters as { list: SubtitleControlListItem[] };
        const primary = get(selected, 'primary');
        const secondary = get(selected, 'secondary');
        let primaryId = '';
        let secondaryId = '';
        if (primary) {
          let subtitles = list
            .filter((sub: SubtitleControlListItem) => sub.hash === primary.hash);
          if (subtitles.length > 1) {
            subtitles = subtitles.filter(sub => isEqual(sub.source, primary.source));
          }
          if (subtitles.length) primaryId = subtitles[0].id;
        }
        if (secondary) {
          let subtitles = list
            .filter((sub: SubtitleControlListItem) => sub.hash === secondary.hash);
          if (subtitles.length > 1) {
            subtitles = subtitles.filter(sub => isEqual(sub.source, secondary.source));
          }
          if (subtitles.length) secondaryId = subtitles[0].id;
        }
        return Promise.all([
          dispatch(a.changePrimarySubtitle, primaryId),
          dispatch(a.changeSecondarySubtitle, secondaryId),
        ]).then(() => {
          primarySelectionComplete = true;
          secondarySelectionComplete = true;
        });
      });
  },
  async [a.addSubtitle]({
    state, commit, dispatch, getters,
  }: any, options: IAddSubtitleOptions) {
    if (options.mediaHash === state.mediaHash) {
      const subtitleGenerator = options.generator;
      try {
        const list = getters.list as SubtitleControlListItem[];
        const hash = await subtitleGenerator.getHash();
        const type = await subtitleGenerator.getType();
        const existedHash = list.find(subtitle => subtitle.hash === hash && subtitle.type === type);
        const source = await subtitleGenerator.getSource();
        const existedOrigin = list.find(subtitle => isEqual(subtitle.source, source.source));
        if (!existedHash || !existedOrigin) {
          const id = uuidv4();
          store.registerModule([id], { ...SubtitleModule, name: `${id}` });
          dispatch(`${id}/${subActions.initialize}`, id);
          const subtitle: Entity = await dispatch(`${id}/${subActions.add}`, subtitleGenerator);
          await dispatch(`${id}/${subActions.store}`);
          const subtitleControlListItem: SubtitleControlListItem = {
            id,
            hash: subtitle.hash,
            type: subtitle.type,
            language: subtitle.language,
            source: subtitle.source.source,
            delay: subtitle.delay,
          };
          commit(m.addSubtitleId, subtitleControlListItem);
          return subtitleControlListItem;
        }
      } catch (ex) {
        log.warn('SubtitleManager addSubtitle action', ex);
      }
    }
    return {};
  },
  [a.removeSubtitle]({ commit, getters }: any, id: string) {
    store.unregisterModule(id);
    commit(m.deleteSubtitleId, id);
    if (getters.isFirstSubtitle && getters.primarySubtitleId === id) {
      commit(m.setPrimarySubtitleId, '');
    } else if (!getters.isFirstSubtitle && getters.secondarySubtitleId === id) {
      commit(m.setSecondarySubtitleId, '');
    }
  },
  async [a.deleteSubtitlesByUuid]({ state, dispatch }: any, subtitles: SubtitleControlListItem[]) {
    subtitles.forEach(({ id }) => {
      if (store.hasModule(id)) dispatch(`${id}/${subActions.delete}`);
      dispatch(`${id}/${subActions.delete}`);
      dispatch(a.removeSubtitle, id);
    });
    return removeSubtitleItemsFromList(subtitles, state.mediaHash);
  },
  async [a.changePrimarySubtitle]({
    dispatch, commit, getters, state,
  }: any, id: string) {
    const primary = id;
    let secondary = getters.secondarySubtitleId;
    if (id === secondary) secondary = '';
    commit(m.setPrimarySubtitleId, primary);
    if (state.allSubtitles[primary]) commit(m.setPrimaryDelay, state.allSubtitles[primary].delay);
    commit(m.setSecondarySubtitleId, secondary);
    if (state.allSubtitles[secondary]) {
      commit(m.setSecondaryDelay, state.allSubtitles[secondary].delay);
    }
    dispatch(a.storeSelectedSubtitle, [primary, secondary]);
    if (id && store.hasModule(id)) await dispatch(`${id}/${subActions.load}`);
  },
  async [a.changeSecondarySubtitle]({ dispatch, commit, getters }: any, id: string) {
    let primary = getters.primarySubtitleId;
    const secondary = id;
    if (id && id === primary) primary = '';
    commit(m.setPrimarySubtitleId, primary);
    if (state.allSubtitles[primary]) commit(m.setPrimaryDelay, state.allSubtitles[primary].delay);
    commit(m.setSecondarySubtitleId, secondary);
    if (state.allSubtitles[secondary]) {
      commit(m.setSecondaryDelay, state.allSubtitles[secondary].delay);
    }
    dispatch(a.storeSelectedSubtitle, [primary, secondary]);
    if (id && store.hasModule(id)) await dispatch(`${id}/${subActions.load}`);
  },
  async [a.storeSelectedSubtitle]({ state }: any, ids: string[]) {
    const { allSubtitles, mediaHash } = state;
    const subtitles = ids
      .filter(id => allSubtitles[id])
      .map((id) => {
        const { hash, source } = allSubtitles[id];
        return { hash, source };
      });
    storeSelectedSubtitles(subtitles as SelectedSubtitle[], mediaHash);
  },
  async [a.startAISelection]({ dispatch }: any) {
    unwatch = store.watch(
      (state: any, getters: { list: SubtitleControlListItem[] }) => getters.list
        .map(({
          id, type, source, language,
        }) => ({
          id, type, source, language,
        })),
      () => dispatch(a.checkSubtitleList),
    );
  },
  [a.checkSubtitleList]({ getters, dispatch }: any) {
    const { list } = getters as { list: SubtitleControlListItem[] };
    if (list.length) {
      const { primaryLanguage, secondaryLanguage } = getters;
      if (!primarySelectionComplete || !secondarySelectionComplete) {
        const hasPrimaryLanguage = list
          .find(({ language }) => language === primaryLanguage);
        const hasSecondaryLanguage = list
          .find(({ language }) => language === secondaryLanguage);
        if (hasPrimaryLanguage) {
          dispatch(a.changePrimarySubtitle, hasPrimaryLanguage.id);
          primarySelectionComplete = true;
          if (hasSecondaryLanguage) {
            dispatch(a.changeSecondarySubtitle, hasSecondaryLanguage.id);
            secondarySelectionComplete = true;
          }
        } else if (hasSecondaryLanguage) {
          if (primarySelectionComplete) {
            dispatch(a.changeSecondarySubtitle, hasSecondaryLanguage.id);
            secondarySelectionComplete = true;
          } else {
            dispatch(a.changePrimarySubtitle, hasSecondaryLanguage.id);
            dispatch(a.changeSecondarySubtitle, '');
            primarySelectionComplete = true;
            secondarySelectionComplete = true;
          }
        } else {
          dispatch(a.changePrimarySubtitle, '');
          dispatch(a.changeSecondarySubtitle, '');
        }
        if (primarySelectionComplete && secondarySelectionComplete) dispatch(a.stopAISelection);
      }
    }
  },
  async [a.stopAISelection]() {
    if (typeof unwatch === 'function') unwatch();
  },
  async [a.getCues]({ dispatch, getters }: any, time?: number) {
    const firstSub = {
      cues: [],
      subPlayResX: 720,
      subPlayResY: 405,
    };
    const secondSub = {
      cues: [],
      subPlayResX: 720,
      subPlayResY: 405,
    };
    if (getters.primarySubtitleId && store.hasModule(getters.primarySubtitleId)) {
      try {
        const { metadata = {}, dialogues = [] } = await dispatch(`${getters.primarySubtitleId}/${subActions.getDialogues}`, time);
        firstSub.cues = dialogues;
        if (metadata) {
          if (metadata.PlayResX) firstSub.subPlayResX = parseInt(metadata.PlayResX, 10);
          if (metadata.PlayResY) firstSub.subPlayResY = parseInt(metadata.PlayResY, 10);
        }
      } catch (error) {
        log.error('SubtitleManager', error);
      }
    }

    if (getters.enabledSecondarySub
      && getters.secondarySubtitleId
      && store.hasModule(getters.secondarySubtitleId)) {
      try {
        const { metadata = {}, dialogues = [] } = await dispatch(`${getters.secondarySubtitleId}/${subActions.getDialogues}`, time);
        secondSub.cues = dialogues;
        if (metadata) {
          if (metadata.PlayResX) firstSub.subPlayResX = parseInt(metadata.PlayResX, 10);
          if (metadata.PlayResY) firstSub.subPlayResY = parseInt(metadata.PlayResY, 10);
        }
      } catch (error) {
        log.error('SubtitleManager', error);
      }
    }
    return [firstSub, secondSub];
  },
  async [a.updatePlayedTime](
    { state, dispatch, getters }: any,
    times: { start: number, end: number },
  ) {
    const actions: Promise<any>[] = [];
    if (times.start !== times.end) {
      const { primarySubtitleId, secondarySubtitleId } = state;
      const bubbleId = `${Date.now()}-${Math.random()}`;
      if (primarySubtitleId && store.hasModule(primarySubtitleId)) {
        actions.push(
          dispatch(`${primarySubtitleId}/${subActions.updatePlayedTime}`, times)
            .then((playedTime: number) => {
              if (playedTime >= getters.duration * 0.6) {
                addBubble(SUBTITLE_UPLOAD, { id: `${SUBTITLE_UPLOAD}-${bubbleId}` });
                dispatch(`${primarySubtitleId}/${subActions.upload}`).then((result: boolean) => {
                  const bubbleType = result ? UPLOAD_SUCCESS : UPLOAD_FAILED;
                  addBubble(bubbleType, { id: `${bubbleType}-${bubbleId}` });
                });
              }
            }),
        );
      }
      if (secondarySubtitleId && store.hasModule(secondarySubtitleId)) {
        actions.push(
          dispatch(`${secondarySubtitleId}/${subActions.updatePlayedTime}`, times)
            .then((playedTime: number) => {
              if (playedTime >= getters.duration * 0.6) {
                addBubble(SUBTITLE_UPLOAD, { id: `${SUBTITLE_UPLOAD}-${bubbleId}` });
                dispatch(`${secondarySubtitleId}/${subActions.upload}`).then((result: boolean) => {
                  const bubbleType = result ? UPLOAD_SUCCESS : UPLOAD_FAILED;
                  addBubble(bubbleType, { id: `${bubbleType}-${bubbleId}` });
                });
              }
            }),
        );
      }
    }
    return Promise.all(actions);
  },
  async [a.manualUploadAllSubtitles]({ state, dispatch }: any) {
    if (navigator.onLine) {
      addBubble(SUBTITLE_UPLOAD);
      const actions: Promise<any>[] = [];
      const { primarySubtitleId, secondarySubtitleId } = state;
      if (primarySubtitleId && store.hasModule(primarySubtitleId)) actions.push(dispatch(`${primarySubtitleId}/${subActions.manualUpload}`));
      if (secondarySubtitleId && store.hasModule(secondarySubtitleId)) actions.push(dispatch(`${secondarySubtitleId}/${subActions.manualUpload}`));
      return Promise.all(actions)
        .then((result: boolean[]) => {
          addBubble(result.every(res => res) ? UPLOAD_SUCCESS : UPLOAD_FAILED);
        });
    }
    return addBubble(UPLOAD_FAILED);
  },
  async [a.alterPrimaryDelay]({ state, dispatch, commit }: any, deltaInSeconds: number) {
    const { primarySubtitleId } = state;
    const delay = await dispatch(`${primarySubtitleId}/${subActions.alterDelay}`, deltaInSeconds);
    commit(m.setPrimaryDelay, delay);
    setDelayTimeout();
  },
  async [a.resetPrimaryDelay]({ state, dispatch, commit }: any) {
    const { primarySubtitleId } = state;
    await dispatch(`${primarySubtitleId}/${subActions.resetDelay}`);
    commit(m.setPrimaryDelay, 0);
    setDelayTimeout();
  },
  async [a.alterSecondaryDelay]({ state, dispatch, commit }: any, deltaInSeconds: number) {
    const { secondarySubtitleId } = state;
    const delay = await dispatch(`${secondarySubtitleId}/${subActions.alterDelay}`, deltaInSeconds);
    commit(m.setSecondaryDelay, delay);
    setDelayTimeout();
  },
  async [a.resetSecondaryDelay]({ state, dispatch, commit }: any) {
    const { secondarySubtitleId } = state;
    await dispatch(`${secondarySubtitleId}/${subActions.resetDelay}`);
    commit(m.setSecondaryDelay, 0);
    setDelayTimeout();
  },
  async [a.storeSubtitleDelays]({ getters, state }: any) {
    const { list } = getters;
    const { mediaHash } = state;
    updateSubtitleList(list, mediaHash);
  },
};

export default {
  state,
  getters,
  mutations,
  actions,
};
