const core = require('@actions/core');
const got = require('got');

const DEFAULT_OS = "linux";
const DEFAULT_ARCH = "amd64";
const DEFAULT_PAGE_LIMIT = 50;

/**
 * Get an Action input variable
 * @param name key name of the variable
 * @param defaultValue default value, if variable value is empty. If null, throw error in this case
 */
function getInputVariable(name, defaultValue) {
    let value = core.getInput(name) || '';
    value = value.trim();

    if (!value) {
        value = defaultValue;
    }
    if (value === null) {
        throw new Error(`Input variable '${name}' not specified!`);
    }

    return value;
}

function parseImage(imageInput) {
    if (!imageInput) {
        throw new Error("No image specified");
    }

    let imageChunks = imageInput.split("/");
    let author;
    let image;
    let tag = 'latest';

    if (imageChunks.length == 1) {
        author = 'library';
        image = imageChunks[0];
    } else if (imageChunks.length == 2) {
        [author, image] = imageChunks;
    } else {
        throw new Error("Invalid image format");
    }

    imageChunks = image.split(":");
    if (imageChunks.length == 2) {
        [image, tag] = imageChunks;
    }

    return [author, image, tag];
}

/**
 * Request tags metadata for a certain image
 */
async function request(author, image, tag, page) {
    const url = `https://registry.hub.docker.com/v2/repositories/${author}/${image}/tags?page=${page}&name=${tag}`;
    console.log(`Requesting ${url} ...`);
    const r = await got(url);

    const statusCode = r.statusCode;
    const body = r.body;
    console.log(`Response statuscode=${statusCode}`);
    console.log(`Response body:\n${body}`);
    if (statusCode !== 200) {
        throw new Error(`Bad statuscode (got ${statusCode}, expected 200)`);
    }

    return body;
}

/**
 * Parse a Response Body
 * @returns Object with the found target image metadata
 * @returns Null if target image not found in current page, but more pages are available
 * @returns False if target image not found, and no more pages are available
 */
function parseResponse(responseBody, tag, os, architecture) {
    const js = JSON.parse(responseBody);

    for (let tagJs of js.results || []) {
        if (tagJs.name !== tag) {
            continue;
        }

        for (let imageJs of tagJs.images) {
            let imageArch = imageJs.architecture;
            let imageArchVariant = imageJs.variant;
            if (imageArchVariant) {
                imageArch = `${imageArch}/${imageArchVariant}`
            }

            if (imageArch !== architecture || imageJs.os !== os) {
                continue;
            }

            // Target image found!
            return {
                digest: imageJs.digest,
                size: imageJs.size,
                tagMetadata: tagJs,
                finalImageMetadata: imageJs
            };
        }
    }

    if (js.next && typeof js.next === 'string') {
        return null;
    }
    return false;
}

async function fetchImageMetadata(author, image, tag, os, architecture, pageLimit) {
    let page = 1;
    let result = null;

    while (result === null && page <= pageLimit) {
        const responseBody = await request(author, image, tag, page);
        result = parseResponse(responseBody, tag, os, architecture);
        page++;
    }

    if (typeof result !== 'object') {
        throw new Error('Image-Tag not found!');
    }

    return result;
}

async function main() {
    try {
        const inputImage = getInputVariable('image', null);
        const imageOS = getInputVariable('os', DEFAULT_OS);
        const imageArch = getInputVariable('architecture', DEFAULT_ARCH);
        const [imageAuthor, imageName, imageTag] = parseImage(inputImage);

        let pageLimit = parseInt(getInputVariable('pageLimit', ''));
        if (isNaN(pageLimit)) pageLimit = DEFAULT_PAGE_LIMIT;

        console.log(`Target image: author=${imageAuthor} name=${imageName} tag=${imageTag} os=${imageOS} arch=${imageArch} pageLimit=${pageLimit}`);
        const tagMetadata = await fetchImageMetadata(imageAuthor, imageName, imageTag, imageOS, imageArch, pageLimit);

        core.setOutput('digest', tagMetadata.digest);
        core.setOutput('size', tagMetadata.size);
        core.setOutput('tagMetadata', tagMetadata.tagMetadata);
        core.setOutput('finalImageMetadata', tagMetadata.finalImageMetadata);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
