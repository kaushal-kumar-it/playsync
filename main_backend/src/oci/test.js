import * as common from "oci-common";

console.log("Available exports:", Object.keys(common));
console.log("\nAuth related:", Object.keys(common).filter(k => k.toLowerCase().includes('auth')));
console.log("\nInstance related:", Object.keys(common).filter(k => k.toLowerCase().includes('instance')));
console.log("\nConfig related:", Object.keys(common).filter(k => k.toLowerCase().includes('config')));