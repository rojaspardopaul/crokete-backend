/** Notification port: sends transactional messages. */
export interface NotificationPort {
  sendOrderConfirmation(input: {
    orderId: string;
    customerId: string | null;
  }): Promise<void>;
}
