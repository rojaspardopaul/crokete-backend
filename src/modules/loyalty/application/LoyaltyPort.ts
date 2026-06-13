/** Loyalty write port: grants points for a paid order. */
export interface LoyaltyPort {
  grantPointsForOrder(input: {
    orderId: string;
    customerId: string | null;
    total: number;
  }): Promise<void>;
}
