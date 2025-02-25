import { useEffect } from 'react';
import { desktopApi } from '@trezor/suite-desktop-api';
import { useActions } from '@suite-hooks';
import { getIsTorDomain } from '@suite-utils/tor';
import * as suiteActions from '@suite-actions/suiteActions';
import { isWeb, isDesktop } from '@suite-utils/env';
import { getLocationHostname } from '@trezor/env-utils';
import { TorStatus } from '@suite-types';

export const useTor = () => {
    const { updateTorStatus } = useActions({
        updateTorStatus: suiteActions.updateTorStatus,
    });

    useEffect(() => {
        if (isWeb()) {
            const isTorDomain = getIsTorDomain(getLocationHostname());
            const newTorStatus = isTorDomain ? TorStatus.Enabled : TorStatus.Disabled;

            updateTorStatus(newTorStatus);
        }

        if (isDesktop()) {
            desktopApi.on('tor/status', (newStatus: boolean) =>
                updateTorStatus(newStatus ? TorStatus.Enabled : TorStatus.Disabled),
            );
            desktopApi.getTorStatus();
        }
    }, [updateTorStatus]);
};
