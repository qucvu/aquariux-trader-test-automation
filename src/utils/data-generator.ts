import { faker } from '@faker-js/faker';

export class DataGenerator {
    static firstName(): string {
        return faker.person.firstName();
    }

    static lastName(): string {
        return faker.person.lastName();
    }

    static fullName(): string {
        return faker.person.fullName();
    }

    static email(): string {
        return faker.internet.email();
    }

    static emailWithPrefix(prefix: string): string {
        return `${prefix}.${faker.string.alphanumeric(6).toLowerCase()}@example.com`;
    }

    static mobile(): string {
        return faker.string.numeric({ length: 10 });
    }

    static username(): string {
        return faker.internet.username();
    }

    static city(): string {
        return faker.location.city();
    }

    static country(): string {
        return faker.location.country();
    }

    static streetAddress(): string {
        return faker.location.streetAddress();
    }

    static zipCode(): string {
        return faker.location.zipCode();
    }

    static password(length = 12): string {
        return faker.internet.password({ length });
    }

    static strongPassword(length = 12): string {
        return faker.internet.password({ length, memorable: false });
    }

    static number(min = 1, max = 1000): number {
        return faker.number.int({ min, max });
    }

    static float(min = 1, max = 1000): number {
        return faker.number.float({ min, max, fractionDigits: 2 });
    }

    static sentence(): string {
        return faker.lorem.sentence();
    }

    static uuid(): string {
        return faker.string.uuid();
    }

    static pick<T>(items: readonly T[]): T {
        if (items.length === 0) {
            throw new Error('Cannot pick from an empty array');
        }
        return faker.helpers.arrayElement([...items]);
    }
}
