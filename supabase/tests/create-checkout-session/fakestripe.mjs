export default class Stripe { constructor(key) { globalThis.__stripeKeyUsed = key; return globalThis.__stripe; } }
