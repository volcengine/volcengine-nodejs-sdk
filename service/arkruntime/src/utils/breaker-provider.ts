import { Breaker } from "./breaker";

/**
 * Maintains a per-model Breaker instance.
 */
export class ModelBreakerProvider {
  private breakers = new Map<string, Breaker>();

  getOrCreate(model: string): Breaker {
    let breaker = this.breakers.get(model);
    if (!breaker) {
      breaker = new Breaker();
      this.breakers.set(model, breaker);
    }
    return breaker;
  }
}
