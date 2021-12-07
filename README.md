# Github Action: DockerHub Fetch Image-Tag Metadata

Github Action for fetching the metadata of a certain Docker image and tag (including the SHA digests), from the DockerHub public registry.

The API endpoint used for fetching the metadata is (with the example of the official Python image): `https://registry.hub.docker.com/v2/repositories/library/python/tags?page=1`

## Action I/O

### Inputs

- `image`: full image name to find, with format `author/image:tag`, or `image:tag` for official images (required)
- `os`: image OS to find (default: `linux`)
- `architecture`: image architecture to find (default: `amd64`)
- `pageLimit`: how many pages of results to parse, until giving up (default: `50`)

### Outputs

**If the image is not found, the Action will fail!**

- `digest`: found image digest (example: `sha256:ec698176504f2f2d0e50e7e627d7db17be0c8c1a36fe34bb5b7c90c79355f7bb`)
- `size`: found image size, in bytes (example: `43640637`)
- Full JSON outputs from the API: these are categorized in two outputs:
    - `tagMetadata` is the whole object for a certain tag (e.g. `python:slim-buster`). This includes an array of images, being each image a variant for a certain os and architecture
    - `finalImageMetadata` is the whole object for a concrete image of the found tag, matching the input os and architecture. This object is filtered out from the array of images found on the "tagMetadata" object
