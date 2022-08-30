import type { TickerId, TimestampedRates, LastWeekRates } from '@suite-common/wallet-types';

import * as coingeckoService from './coingecko';
import * as blockbookService from './blockbook';

export const { getTickerConfig, fetchCurrentTokenFiatRates } = coingeckoService;

export const fetchCurrentFiatRates = async (ticker: TickerId): Promise<TimestampedRates | null> => {
    const res = blockbookService.isTickerSupported(ticker)
        ? await blockbookService.fetchCurrentFiatRates(ticker.symbol)
        : null;
    return res ?? coingeckoService.fetchCurrentFiatRates(ticker);
};

export const fetchLastWeekFiatRates = async (
    ticker: TickerId,
    currency: string,
): Promise<LastWeekRates | null> => {
    const res = blockbookService.isTickerSupported(ticker)
        ? await blockbookService.fetchLastWeekRates(ticker.symbol, currency)
        : null;
    return res ?? coingeckoService.fetchLastWeekRates(ticker, currency);
};

export const getFiatRatesForTimestamps = async (
    ticker: TickerId,
    timestamps: number[],
): Promise<LastWeekRates | null> => {
    const res = blockbookService.isTickerSupported(ticker)
        ? await blockbookService.getFiatRatesForTimestamps(ticker.symbol, timestamps)
        : null;
    return res ?? coingeckoService.getFiatRatesForTimestamps(ticker, timestamps);
};
