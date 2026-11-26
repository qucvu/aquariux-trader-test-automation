import { DataReader } from '@utils/data-reader';

interface TradingTestData {
    symbol: string;
    symbolSecondary: string;
    volume: {
        min: number;
        belowMin: number;
    };
    stopLoss: { points: number };
    takeProfit: { points: number };
    pending: {
        offsetPoints: number;
        volume: number;
    };
    bulk: { symbols: string[] };
    close: {
        partialVolume: number;
        excessiveVolume: number;
    };
}

export function tradingData(): TradingTestData {
    return DataReader.json<TradingTestData>('src/testdata/trading.json');
}

export const tradingStates = {
    filled: /^filled$/i,
    canceled: /^canceled$/i,
};
