import React from 'react';
import styled from 'styled-components';

import { FirmwareChangelog } from '@firmware-components';
import { Icon, Tooltip, variables } from '@trezor/components';
import { Translation } from '@suite-components';
import { getFirmwareType, getFirmwareVersion } from '@trezor/device-utils';
import { getFwUpdateVersion, parseFirmwareChangelog } from '@suite-utils/device';
import { useFirmware, useTranslation } from '@suite-hooks';
import { AcquiredDevice, FirmwareType } from '@suite-types';

const FwVersionWrapper = styled.div`
    display: flex;
    width: 100%;
    max-width: 364px;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0px;
`;

const FwVersion = styled.div`
    font-weight: ${variables.FONT_WEIGHT.MEDIUM};
    text-align: center;

    &:only-child {
        margin: 0 auto;
    }
`;

const Version = styled.div<{ isNew?: boolean }>`
    color: ${({ isNew, theme }) => (isNew ? theme.TYPE_GREEN : theme.TYPE_LIGHT_GREY)};
    font-size: ${variables.FONT_SIZE.SMALL};
    font-variant-numeric: tabular-nums;
    margin-top: 6px;
`;

const Label = styled.div`
    font-size: ${variables.FONT_SIZE.TINY};
`;

interface FirmwareOfferProps {
    device: AcquiredDevice;
    customFirmware?: boolean;
    targetFirmwareType?: FirmwareType;
}

export const FirmwareOffer = ({
    device,
    customFirmware,
    targetFirmwareType,
}: FirmwareOfferProps) => {
    const { targetType } = useFirmware();
    const { translationString } = useTranslation();

    const currentVersion = device.firmware !== 'none' ? getFirmwareVersion(device) : undefined;
    const nextVersion = customFirmware
        ? translationString('TR_CUSTOM_FIRMWARE_VERSION')
        : getFwUpdateVersion(device);
    const parsedChangelog = customFirmware
        ? null
        : parseFirmwareChangelog(device.features, device.firmwareRelease);
    const currentTypeAndVersion = `${getFirmwareType(device)} ${currentVersion ?? ''}`.trim();
    const nextTypeAndVersion = `${(targetFirmwareType || targetType) ?? ''} ${
        nextVersion ?? ''
    }`.trim();

    const nextVersionElement = (
        <Version isNew data-test="@firmware/offer-version/new">
            {nextTypeAndVersion}
        </Version>
    );

    return (
        <FwVersionWrapper>
            {currentVersion && (
                <>
                    <FwVersion>
                        <Label>
                            <Translation id="TR_ONBOARDING_CURRENT_VERSION" />
                        </Label>
                        <Version>{currentTypeAndVersion}</Version>
                    </FwVersion>
                    <Icon icon="ARROW_RIGHT_LONG" size={16} />
                </>
            )}
            <FwVersion>
                <Label>
                    <Translation id="TR_ONBOARDING_NEW_VERSION" />
                </Label>
                {parsedChangelog ? (
                    <Tooltip
                        rich
                        dashed
                        content={<FirmwareChangelog device={device} {...parsedChangelog} />}
                        placement="top"
                    >
                        {nextVersionElement}
                    </Tooltip>
                ) : (
                    nextVersionElement
                )}
            </FwVersion>
        </FwVersionWrapper>
    );
};
