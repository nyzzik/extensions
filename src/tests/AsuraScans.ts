import { type TestLogger } from "@paperback/types";
import { TestSuite, registerDefaultTests } from "./suite.js";
import { AsuraScans } from "../AsuraScans/main.js";
import sourceInfo from "../AsuraScans/pbconfig.js";

export async function runTests(logger: TestLogger) {
    const suite = new TestSuite("AsuraScans tests", logger);
    registerDefaultTests(suite, AsuraScans, sourceInfo);

    await suite.run();
}
