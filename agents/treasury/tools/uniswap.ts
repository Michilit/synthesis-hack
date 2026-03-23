/**
 * Mock Uniswap integration for treasury rebalancing
 * In production: use @uniswap/v3-sdk with real pool data
 */

export interface SwapResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  priceImpact: number;
  fee: number;
}

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: number;
  valueUSD: number;
}

// Mock prices in USD
const MOCK_PRICES: Record<string, number> = {
  ETH:  2500,
  WETH: 2500,
  USDC: 1,
  DAI:  1,
  WBTC: 68000,
};

// Internal mock balances (would be read from contract in production)
const mockBalances: Record<string, number> = {
  ETH:  3.2,
  USDC: 12400,
  DAI:  8100,
};

export class UniswapTool {
  async getPrice(tokenIn: string, tokenOut: string): Promise<number> {
    const priceIn = MOCK_PRICES[tokenIn] || 1;
    const priceOut = MOCK_PRICES[tokenOut] || 1;
    return priceIn / priceOut;
  }

  async swap(tokenIn: string, tokenOut: string, amountIn: number): Promise<SwapResult> {
    if (process.env.MOCK_LLM !== 'false') {
      const rate = await this.getPrice(tokenIn, tokenOut);
      const fee = amountIn * 0.003; // 0.3% Uniswap fee
      const amountOut = (amountIn - fee) * rate;
      const priceImpact = amountIn > 10000 ? 0.5 : 0.05; // mock price impact

      // Update mock balances
      mockBalances[tokenIn] = (mockBalances[tokenIn] || 0) - amountIn;
      mockBalances[tokenOut] = (mockBalances[tokenOut] || 0) + amountOut;

      console.log(`[UniswapMock] Swapped ${amountIn} ${tokenIn} → ${amountOut.toFixed(4)} ${tokenOut} (fee: ${fee.toFixed(4)})`);
      return { tokenIn, tokenOut, amountIn, amountOut, priceImpact, fee };
    }
    throw new Error('Real Uniswap integration not implemented for hackathon');
  }

  async getLiquidity(token: string): Promise<number> {
    // Mock liquidity depth in USD
    const liquidityMap: Record<string, number> = {
      ETH: 5_000_000_000,
      USDC: 3_000_000_000,
      DAI: 1_500_000_000,
      WETH: 4_000_000_000,
    };
    return liquidityMap[token] || 100_000;
  }

  async getPortfolio(): Promise<TokenBalance[]> {
    return Object.entries(mockBalances).map(([symbol, balance]) => ({
      symbol,
      address: `0x${symbol.toLowerCase().padEnd(40, '0')}`,
      balance,
      valueUSD: balance * (MOCK_PRICES[symbol] || 1),
    }));
  }

  async getAllocation(): Promise<{ stables: number; crypto: number; rwa: number }> {
    const portfolio = await this.getPortfolio();
    const total = portfolio.reduce((s, t) => s + t.valueUSD, 0);
    const stables = portfolio
      .filter(t => ['USDC', 'DAI', 'USDT'].includes(t.symbol))
      .reduce((s, t) => s + t.valueUSD, 0);
    const crypto = portfolio
      .filter(t => ['ETH', 'WETH', 'WBTC'].includes(t.symbol))
      .reduce((s, t) => s + t.valueUSD, 0);
    return {
      stables: total > 0 ? stables / total : 0,
      crypto:  total > 0 ? crypto / total : 0,
      rwa:     total > 0 ? (total - stables - crypto) / total : 0,
    };
  }
}
