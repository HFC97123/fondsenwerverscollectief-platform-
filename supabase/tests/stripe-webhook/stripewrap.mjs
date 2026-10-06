import RealStripe from 'stripe';
export default class Stripe extends RealStripe {
  constructor(key, opts) {
    super(key, opts);
    globalThis.__stripeKeyUsed = key;
    const self = this;
    this.subscriptions.retrieve = async (id) => {
      globalThis.__retrieveCalls.push(id);
      return globalThis.__fake.retrieve(id);
    };
  }
}
