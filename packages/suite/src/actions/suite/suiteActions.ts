import TrezorConnect, { Device, DEVICE } from '@trezor/connect';
import { analytics, EventType } from '@trezor/suite-analytics';
import { desktopApi, HandshakeElectron } from '@trezor/suite-desktop-api';

import * as comparisonUtils from '@suite-utils/comparisonUtils';
import * as deviceUtils from '@suite-utils/device';
import { getIsTorLoading, isOnionUrl } from '@suite-utils/tor';
import { getCustomBackends } from '@suite-common/wallet-utils';
import { sortByTimestamp } from '@suite-utils/device';
import { notificationsActions } from '@suite-common/toast-notifications';
import * as modalActions from '@suite-actions/modalActions';
import * as firmwareActions from '@firmware-actions/firmwareActions';
import { TorStatus } from '@suite-types';
import { SUITE, METADATA } from './constants';
import type { Locale } from '@suite-config/languages';
import type {
    Action,
    Dispatch,
    GetState,
    TrezorDevice,
    ButtonRequest,
    AppState,
} from '@suite-types';
import type { DebugModeOptions, AutodetectSettings } from '@suite-reducers/suiteReducer';
import type { TranslationKey } from '@suite-components/Translation/components/BaseTranslation';
import { createAction } from '@reduxjs/toolkit';

export type SuiteAction =
    | { type: typeof SUITE.INIT }
    | { type: typeof SUITE.READY }
    | { type: typeof SUITE.ERROR; error: string }
    | { type: typeof SUITE.DESKTOP_HANDSHAKE; payload: HandshakeElectron }
    | { type: typeof SUITE.SELECT_DEVICE; payload?: TrezorDevice }
    | { type: typeof SUITE.UPDATE_SELECTED_DEVICE; payload: TrezorDevice }
    | {
          type: typeof SUITE.UPDATE_PASSPHRASE_MODE;
          payload: TrezorDevice;
          hidden: boolean;
          alwaysOnDevice?: boolean;
      }
    | { type: typeof SUITE.AUTH_DEVICE; payload: TrezorDevice; state: string }
    | { type: typeof SUITE.AUTH_FAILED; payload: TrezorDevice }
    | { type: typeof SUITE.REQUEST_AUTH_CONFIRM }
    | { type: typeof SUITE.RECEIVE_AUTH_CONFIRM; payload: TrezorDevice; success: boolean }
    | { type: typeof SUITE.CREATE_DEVICE_INSTANCE; payload: TrezorDevice }
    | { type: typeof SUITE.FORGET_DEVICE; payload: TrezorDevice }
    | {
          type: typeof SUITE.REMEMBER_DEVICE;
          payload: TrezorDevice;
          remember: boolean;
          forceRemember?: true;
      }
    | {
          type: typeof SUITE.SET_LANGUAGE;
          locale: Locale;
      }
    | { type: typeof SUITE.SET_DEBUG_MODE; payload: Partial<DebugModeOptions> }
    | { type: typeof SUITE.ONLINE_STATUS; payload: boolean }
    | { type: typeof SUITE.TOR_STATUS; payload: TorStatus }
    | { type: typeof SUITE.ONION_LINKS; payload: boolean }
    | { type: typeof SUITE.LOCK_UI; payload: boolean }
    | ReturnType<typeof lockDevice>
    | { type: typeof SUITE.LOCK_ROUTER; payload: boolean }
    | {
          type: typeof SUITE.SET_FLAG;
          key: keyof AppState['suite']['flags'];
          value: boolean;
      }
    | { type: typeof SUITE.APP_CHANGED; payload: AppState['router']['app'] }
    | {
          type: typeof SUITE.ADD_BUTTON_REQUEST;
          device: TrezorDevice | undefined;
          payload?: ButtonRequest;
      }
    | {
          type: typeof SUITE.SET_PROCESS_MODE;
          device: TrezorDevice;
          payload: TrezorDevice['processMode'];
      }
    | {
          type: typeof SUITE.SET_THEME;
          variant: AppState['suite']['settings']['theme']['variant'];
      }
    | {
          type: typeof SUITE.SET_AUTODETECT;
          payload: Partial<AutodetectSettings>;
      }
    | { type: typeof SUITE.REQUEST_DEVICE_RECONNECT };

export const desktopHandshake = (payload: HandshakeElectron): SuiteAction => ({
    type: SUITE.DESKTOP_HANDSHAKE,
    payload,
});

export const removeButtonRequests = (device: TrezorDevice | undefined) => ({
    type: SUITE.ADD_BUTTON_REQUEST,
    device,
});

export const addButtonRequest = (device: TrezorDevice | undefined, payload: ButtonRequest) => ({
    type: SUITE.ADD_BUTTON_REQUEST,
    device,
    payload,
});

export const setTheme = (
    variant: AppState['suite']['settings']['theme']['variant'],
): SuiteAction => ({
    type: SUITE.SET_THEME,
    variant,
});

export const setAutodetect = (payload: Partial<AutodetectSettings>): SuiteAction => ({
    type: SUITE.SET_AUTODETECT,
    payload,
});

export const setProcessMode = (
    device: TrezorDevice,
    processMode: TrezorDevice['processMode'],
): SuiteAction => ({
    type: SUITE.SET_PROCESS_MODE,
    device,
    payload: processMode,
});

export const setFlag = (key: keyof AppState['suite']['flags'], value: boolean): SuiteAction => ({
    type: SUITE.SET_FLAG,
    key,
    value,
});

export const initialRunCompleted = () => (dispatch: Dispatch, getState: GetState) => {
    if (getState().suite.flags.initialRun) {
        dispatch(setFlag('initialRun', false));
    }
};

/**
 * Triggered by `@suite-support/OnlineStatus` or `@suite-native/support/OnlineStatus`
 * Set `online` status in suite reducer
 * @param {boolean} payload
 * @returns {SuiteAction}
 */
export const updateOnlineStatus = (payload: boolean): SuiteAction => ({
    type: SUITE.ONLINE_STATUS,
    payload,
});

/**
 * Triggered by `@suite-support/TorStatus`
 * Set `tor` status in suite reducer
 * @param {boolean} payload
 * @returns {Action}
 */
export const updateTorStatus = (payload: TorStatus): SuiteAction => ({
    type: SUITE.TOR_STATUS,
    payload,
});

export const toggleTor =
    (shouldEnable: boolean) => async (dispatch: Dispatch, getState: GetState) => {
        const isTorLoading = getIsTorLoading(getState().suite.torStatus);

        if (isTorLoading) {
            return;
        }

        const backends = getCustomBackends(getState().wallet.blockchain);
        // Is there any network with only onion custom backends?
        const hasOnlyOnionBackends = backends.some(
            ({ urls }) => urls.length && urls.every(isOnionUrl),
        );

        if (!shouldEnable && hasOnlyOnionBackends) {
            const res = await dispatch(modalActions.openDeferredModal({ type: 'disable-tor' }));
            if (!res) return;
        }

        const progressStatus = shouldEnable ? TorStatus.Enabling : TorStatus.Disabling;

        dispatch(updateTorStatus(progressStatus));

        const ipcResponse = await desktopApi.toggleTor(shouldEnable);

        if (ipcResponse.success) {
            const newStatus = shouldEnable ? TorStatus.Enabled : TorStatus.Disabled;

            dispatch(updateTorStatus(newStatus));

            analytics.report({
                type: EventType.SettingsTor,
                payload: {
                    value: shouldEnable,
                },
            });
        }

        if (!ipcResponse.success && ipcResponse.error) {
            const previousStatus = shouldEnable ? TorStatus.Disabled : TorStatus.Enabled;

            dispatch(updateTorStatus(previousStatus));

            dispatch(
                notificationsActions.addToast({
                    type: 'tor-toggle-error',
                    error: ipcResponse.error as TranslationKey,
                }),
            );

            return Promise.reject();
        }
    };

export const setOnionLinks = (payload: boolean): SuiteAction => ({
    type: SUITE.ONION_LINKS,
    payload,
});

/**
 * Called from `suiteMiddleware`
 * Set `loaded` field in suite reducer
 * @returns {SuiteAction}
 */
export const onSuiteReady = (): SuiteAction => ({
    type: SUITE.READY,
});

/**
 * Triggered by user action in:
 * - Debug Settings
 * Set `debug` object in suite reducer
 * @param {boolean} payload
 * @returns {SuiteAction}
 */
export const setDebugMode = (payload: Partial<DebugModeOptions>): SuiteAction => ({
    type: SUITE.SET_DEBUG_MODE,
    payload,
});

/**
 * Called from multiple places before and after TrezorConnect call
 * Prevent from mad clicking
 * Set `lock` field in suite reducer
 * @returns {SuiteAction}
 */
export const lockUI = (payload: boolean): SuiteAction => ({
    type: SUITE.LOCK_UI,
    payload,
});

/**
 * Prevent TrezorConnect multiple calls
 * Called before and after specific process, like onboarding
 * Set `lock` field in suite reducer
 * @returns {SuiteAction}
 */
export const lockDevice = createAction(SUITE.LOCK_DEVICE, (payload: boolean) => ({ payload }));

/**
 * Prevent route change and rendering
 * Called before and after specific process, like onboarding
 * Set `lock` field in suite reducer
 * @returns {SuiteAction}
 */
export const lockRouter = (payload: boolean): SuiteAction => ({
    type: SUITE.LOCK_ROUTER,
    payload,
});

/**
 * Called from:
 * - `@trezor/connect` events handler `handleDeviceConnect`, `handleDeviceDisconnect`
 * - from user action in `@suite-components/DeviceMenu`
 * @param {(Device | TrezorDevice | undefined)} device
 */
export const selectDevice =
    (device?: Device | TrezorDevice) => (dispatch: Dispatch, getState: GetState) => {
        let payload: TrezorDevice | typeof undefined;
        if (device) {
            // "ts" is one of the field which distinguish Device from TrezorDevice
            const { ts } = device as TrezorDevice;
            if (typeof ts === 'number') {
                // requested device is a @suite TrezorDevice type. get exact instance from reducer
                payload = deviceUtils.getSelectedDevice(device as TrezorDevice, getState().devices);
            } else {
                // requested device is a @trezor/connect Device type
                // find all instances and select recently used
                const instances = getState().devices.filter(d => d.path === device.path);
                // eslint-disable-next-line prefer-destructuring
                payload = deviceUtils.sortByTimestamp(instances)[0];
            }
        }

        // 3. select requested device
        dispatch({
            type: SUITE.SELECT_DEVICE,
            payload,
        });
    };

/**
 * Toggles remembering the given device. I.e. if given device is not remembered it will become remembered
 * and if it is remembered it will be forgotten.
 * @param forceRemember can be set to `true` to remember given device regardless of its current state.
 *
 * Use `forgetDevice` to forget a device regardless if its current state.
 */
export const toggleRememberDevice = (payload: TrezorDevice, forceRemember?: true): SuiteAction => ({
    type: SUITE.REMEMBER_DEVICE,
    payload,
    remember: !payload.remember || !!forceRemember,
    // if device is already remembered, do not force it, it would remove the remember on return to suite
    forceRemember: payload.remember ? undefined : forceRemember,
});

export const forgetDevice = (payload: TrezorDevice): SuiteAction => ({
    type: SUITE.FORGET_DEVICE,
    payload,
});

/**
 * Triggered by `@trezor/connect DEVICE_EVENT`
 * @param {Device} device
 * @param {boolean} [useEmptyPassphrase=false]
 */
export const createDeviceInstance =
    (device: TrezorDevice, useEmptyPassphrase = false) =>
    async (dispatch: Dispatch, getState: GetState) => {
        if (!device.features) return;
        if (!device.features.passphrase_protection) {
            const response = await TrezorConnect.applySettings({
                device,
                use_passphrase: true,
            });

            if (!response.success) {
                dispatch(
                    notificationsActions.addToast({ type: 'error', error: response.payload.error }),
                );
                return;
            }

            dispatch(notificationsActions.addToast({ type: 'settings-applied' }));
        }

        dispatch({
            type: SUITE.CREATE_DEVICE_INSTANCE,
            payload: {
                ...device,
                useEmptyPassphrase,
                instance: deviceUtils.getNewInstanceNumber(getState().devices, device),
            },
        });
    };

/**
 * Triggered by `@trezor/connect DEVICE_EVENT`
 * @param {Device} device
 */
export const handleDeviceConnect = (device: Device) => (dispatch: Dispatch, getState: GetState) => {
    const selectedDevice = getState().suite.device;
    const { firmware } = getState();
    // We are waiting for device in bootloader mode (only in firmware update)
    if (
        selectedDevice &&
        device.features &&
        device.mode === 'bootloader' &&
        ['reconnect-in-normal', 'waiting-for-bootloader'].includes(firmware.status)
    ) {
        dispatch(selectDevice(device));
    }
    if (!selectedDevice) {
        dispatch(selectDevice(device));
    } else {
        // TODO: show some nice notification/tooltip in DeviceMenu
    }
};

/**
 * Triggered by `@trezor/connect DEVICE_EVENT`
 * @param {Device} device
 */
export const handleDeviceDisconnect =
    (device: Device) => (dispatch: Dispatch, getState: GetState) => {
        const selectedDevice = getState().suite.device;
        if (!selectedDevice) return;
        if (selectedDevice.path !== device.path) return;

        const { devices, router } = getState();

        /**
         * Under normal circumstances, after device is disconnected we want suite to select another existing device (either remembered or physically connected)
         * This is not the case in firmware update and onboarding; In this case we simply wan't suite.device to be empty until user reconnects a device again
         */
        if (['onboarding', 'firmware', 'firmware-type'].includes(router.app)) {
            dispatch({ type: SUITE.SELECT_DEVICE, payload: undefined });
            return;
        }

        // selected device is disconnected, decide what to do next
        // device is still present in reducer (remembered or candidate to remember)
        const devicePresent = deviceUtils.getSelectedDevice(selectedDevice, devices);
        const deviceInstances = deviceUtils.getDeviceInstances(selectedDevice, devices);
        if (deviceInstances.length > 0) {
            // if selected device is gone from reducer, switch to first instance
            if (!devicePresent) {
                dispatch({ type: SUITE.SELECT_DEVICE, payload: deviceInstances[0] });
            }
            return;
        }
        // const routerLocked = getState().suite.locks.includes(SUITE.LOCK_TYPE.ROUTER);
        // if (devices.length < 1 || routerLocked) {
        //     dispatch({ type: SUITE.SELECT_DEVICE });
        //     return;
        // }

        const available = deviceUtils.getFirstDeviceInstance(devices);
        dispatch({ type: SUITE.SELECT_DEVICE, payload: available[0] });
    };

/**
 * Triggered by `@trezor/connect DEVICE_EVENT` via suiteMiddleware
 * Remove all data related to all instances of disconnected device if they are not remembered
 * @param {Device} device
 */
export const forgetDisconnectedDevices =
    (device: Device) => (dispatch: Dispatch, getState: GetState) => {
        const deviceInstances = getState().devices.filter(d => d.id === device.id);
        deviceInstances.forEach(d => {
            if (d.features && !d.remember) {
                dispatch(forgetDevice(d));
            }
        });
    };

/**
 * list of actions which has influence on `device` field inside `suite` reducer
 * all other actions should be ignored
 */
const actions = [
    SUITE.AUTH_DEVICE,
    SUITE.AUTH_FAILED,
    SUITE.SELECT_DEVICE,
    SUITE.RECEIVE_AUTH_CONFIRM,
    SUITE.UPDATE_PASSPHRASE_MODE,
    SUITE.ADD_BUTTON_REQUEST,
    SUITE.REMEMBER_DEVICE,
    SUITE.FORGET_DEVICE,
    SUITE.SET_PROCESS_MODE,
    METADATA.SET_DEVICE_METADATA,
    METADATA.WALLET_LOADED,
    METADATA.WALLET_ADD,
    ...Object.values(DEVICE).filter(v => typeof v === 'string'),
];

/**
 * Called from `suiteMiddleware`
 * Keep `suite` reducer synchronized with `devices` reducer
 * @param {Action} action
 */
export const observeSelectedDevice =
    (action: Action) => (dispatch: Dispatch, getState: GetState) => {
        // ignore not listed actions
        if (actions.indexOf(action.type) < 0) return false;

        const selectedDevice = getState().suite.device;
        if (!selectedDevice) return false;

        const deviceFromReducer = deviceUtils.getSelectedDevice(selectedDevice, getState().devices);
        if (!deviceFromReducer) return true;

        const changed = comparisonUtils.isChanged(selectedDevice, deviceFromReducer);
        if (changed) {
            dispatch({
                type: SUITE.UPDATE_SELECTED_DEVICE,
                payload: deviceFromReducer,
            });
        }

        return changed;
    };

/**
 * Called from <AcquireDevice /> component
 * Fetch device features without asking for pin/passphrase
 * this is the only place where useEmptyPassphrase should be always set to "true"
 */
export const acquireDevice =
    (requestedDevice?: TrezorDevice) => async (dispatch: Dispatch, getState: GetState) => {
        const selectedDevice = getState().suite.device;
        if (!selectedDevice && !requestedDevice) return;
        const device = requestedDevice || selectedDevice;

        const response = await TrezorConnect.getFeatures({
            device,
            useEmptyPassphrase: true,
        });

        if (!response.success) {
            dispatch(
                notificationsActions.addToast({
                    type: 'acquire-error',
                    device,
                    error: response.payload.error,
                }),
            );
        }
    };

/**
 * Inner action used in `authorizeDevice`
 */
const updatePassphraseMode = (device: TrezorDevice, hidden: boolean): SuiteAction => ({
    type: SUITE.UPDATE_PASSPHRASE_MODE,
    payload: device,
    hidden,
});

/**
 * Called from `discoveryMiddleware`
 * Fetch device state, update `devices` reducer as result of SUITE.AUTH_DEVICE
 */
export const authorizeDevice =
    () =>
    async (dispatch: Dispatch, getState: GetState): Promise<boolean> => {
        const { device, settings } = getState().suite;
        if (!device) return false;
        const isDeviceReady =
            device.connected &&
            device.features &&
            !device.state &&
            device.mode === 'normal' &&
            device.firmware !== 'required';
        if (!isDeviceReady) return false;

        if (settings.debug.checkFirmwareAuthenticity) {
            await dispatch(firmwareActions.checkFirmwareAuthenticity());
        }

        const response = await TrezorConnect.getDeviceState({
            device: {
                path: device.path,
                instance: device.instance,
                state: undefined,
            },
            keepSession: true,
            useEmptyPassphrase: device.useEmptyPassphrase,
        });

        if (response.success) {
            const { state } = response.payload;
            const s = state.split(':')[0];
            const duplicate = getState().devices.find(
                d => d.state && d.state.split(':')[0] === s && d.instance !== device.instance,
            );
            // get fresh data from reducer, `useEmptyPassphrase` might be changed after TrezorConnect call
            const freshDeviceData = deviceUtils.getSelectedDevice(device, getState().devices);
            if (duplicate) {
                if (freshDeviceData!.useEmptyPassphrase) {
                    // if currently selected device uses empty passphrase
                    // make sure that founded duplicate will also use empty passphrase
                    dispatch(updatePassphraseMode(duplicate, false));
                    // reset useEmptyPassphrase field for selected device to allow future PassphraseRequests
                    dispatch(updatePassphraseMode(device, true));
                }
                dispatch(
                    modalActions.openModal({ type: 'passphrase-duplicate', device, duplicate }),
                );
                return false;
            }

            dispatch({
                type: SUITE.AUTH_DEVICE,
                payload: freshDeviceData,
                state,
            });
            return true;
        }

        dispatch({ type: SUITE.AUTH_FAILED, payload: device });
        dispatch(
            notificationsActions.addToast({ type: 'auth-failed', error: response.payload.error }),
        );
        return false;
    };

/**
 * Inner action used in `authConfirm`
 */
const receiveAuthConfirm = (device: TrezorDevice, success: boolean): SuiteAction => ({
    type: SUITE.RECEIVE_AUTH_CONFIRM,
    payload: device,
    success,
});

/**
 * Called from `suiteMiddleware`
 */
export const authConfirm = () => async (dispatch: Dispatch, getState: GetState) => {
    const { device } = getState().suite;
    if (!device) return false;

    const response = await TrezorConnect.getDeviceState({
        device: {
            path: device.path,
            instance: device.instance,
            state: undefined,
        },
        keepSession: false,
    });

    if (!response.success) {
        // handle error passed from Passphrase modal
        if (response.payload.error === 'auth-confirm-cancel') {
            // needs await to propagate all actions
            await dispatch(createDeviceInstance(device));
            // forget previous empty wallet
            dispatch(forgetDevice(device));
            return;
        }
        dispatch(
            notificationsActions.addToast({
                type: 'auth-confirm-error',
                error: response.payload.error,
            }),
        );
        dispatch(receiveAuthConfirm(device, false));
        return;
    }

    if (response.payload.state !== device.state) {
        dispatch(notificationsActions.addToast({ type: 'auth-confirm-error' }));
        dispatch(receiveAuthConfirm(device, false));
        return;
    }

    dispatch(receiveAuthConfirm(device, true));
};

/**
 * Called from `suiteMiddleware`
 */
export const switchDuplicatedDevice =
    (device: TrezorDevice, duplicate: TrezorDevice) => async (dispatch: Dispatch) => {
        // close modal
        dispatch(modalActions.onCancel());
        // release session from authorizeDevice
        await TrezorConnect.getFeatures({
            device,
            keepSession: false,
        });

        // switch to existing wallet
        // NOTE: await is important. otherwise `forgetDevice` action will be resolved first leading to race condition:
        // forgetDevice > suiteMiddleware > handleDeviceDisconnect > selectDevice (first available)
        await dispatch(selectDevice(duplicate));
        // remove stateless instance
        dispatch(forgetDevice(device));
    };

export const requestDeviceReconnect = () => ({
    type: SUITE.REQUEST_DEVICE_RECONNECT,
});

export const initDevices = () => (dispatch: Dispatch, getState: GetState) => {
    // select first device from storage
    const {
        suite: { device },
        devices,
    } = getState();

    if (!device && devices && devices[0]) {
        // if there are force remember devices, forget them and pick the first one of them as selected device
        const forcedDevices = devices.filter(d => d.forceRemember && d.remember);
        forcedDevices.forEach(d => {
            dispatch(toggleRememberDevice(d));
        });
        dispatch(
            selectDevice(
                forcedDevices.length ? forcedDevices[0] : sortByTimestamp([...devices])[0],
            ),
        );
    }
};
