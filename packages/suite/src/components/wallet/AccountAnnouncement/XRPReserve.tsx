import React from 'react';
import Bignumber from 'bignumber.js';
import { NotificationCard, Translation, ReadMoreLink } from '@suite-components';
import { formatNetworkAmount } from '@suite-common/wallet-utils';
import type { Account } from '@wallet-types/index';

interface Props {
    account: Account | undefined;
}

const XRPReserve = ({ account }: Props) => {
    if (account?.networkType !== 'ripple') return null;
    const bigBalance = new Bignumber(account.balance);
    const bigReserve = new Bignumber(account.misc.reserve);
    return bigBalance.isLessThan(bigReserve) ? (
        <NotificationCard
            variant="info"
            button={{
                children: <ReadMoreLink url="HELP_CENTER_XRP_URL" />,
            }}
        >
            <Translation
                id="TR_XRP_RESERVE_INFO"
                values={{
                    minBalance: formatNetworkAmount(account.misc.reserve, 'xrp'),
                }}
            />
        </NotificationCard>
    ) : null;
};

export default XRPReserve;
