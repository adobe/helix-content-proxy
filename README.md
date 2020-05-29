# Helix Content Proxy

> Helix Content Proxy is not a Content Repository

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-content-proxy.svg)](https://codecov.io/gh/adobe/helix-content-proxy)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-content-proxy.svg)](https://circleci.com/gh/adobe/helix-content-proxy)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-content-proxy.svg)](https://github.com/adobe/helix-content-proxy/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-content-proxy.svg)](https://github.com/adobe/helix-content-proxy/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-content-proxy.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-content-proxy)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) 

## Purpose

`helix-content-proxy` serves Markdown documents (later JSON tables, too) from data sources supported by Project Helix (GitHub, Google Docs, OneDrive) and applies transparent resolution of an [`fstab.yaml`](https://github.com/adobe/helix-shared/blob/master/docs/fstab.md) configuration files, so that all kinds of content can be retrieved just by knowing `owner`, `repo`, `ref`, and `path`. `helix-content-proxy` is intended to be used by [`helix-pipeline`](https://github.com/adobe/helix-pipeline), where it will replace the existing logic for fetching external content from Google Docs and OneDrive and behave like a drop-in-replacement to `raw.githubusercontent.com`.

### Limitations

`helix-content-proxy` assumes `ref` to be an immutable sha, so use `helix-resolve-git-ref` before if you need to resolve a branch or tag name. This limitation is intentional to simplify `helix-content-proxy` and to allow serving content with immutable caching characteristics.

## Usage

Try:
* https://adobeioruntime.net/api/v1/web/helix/helix-services/content-proxy@v1?ref=a909113cb32cc3dea62e4c981ec4e6eac2e6d3e1&path=/docs/fstab.md&owner=adobe&repo=helix-shared

```bash
curl https://adobeioruntime.net/api/v1/web/helix/helix-services/content-proxy@v1?owner=…&repo=…&ref=…&path=….md
```

### Caching

`helix-content-proxy` is served with following caching settings:

```http
cache-control: max-age=30758400
surrogate-control: max-age=30758400, stale-while-revalidate=30758400, stale-if-error=30758400, immutable
x-last-activation-id: c0f5d3fbbe584a81b5d3fbbe587a81fc
x-openwhisk-activation-id: 9f934cae5e6c482a934cae5e6c182ac3
x-source-location: https://raw.githubusercontent.com/adobe/helix-shared/a909113cb32cc3dea62e4c981ec4e6eac2e6d3e1/docs/fstab.md
```

* `cache-control`: to keep content cached in Adobe I/O Runtime and by `helix-fetch`
* `surrogate-control`: to keep content cached in Fastly (with push invalidation)
* `x-source-location`: to allow `helix-pipeline` to calculate a source hash for surrogate-key based push invalidation

For more, see the [API documentation](docs/API.md).

## Development

### Deploying Helix Content Proxy

Deploying Helix Content Proxy requires the `wsk` command line client, authenticated to a namespace of your choice. For Project Helix, we use the `helix` namespace.

All commits to master that pass the testing will be deployed automatically. All commits to branches that will pass the testing will get commited as `/helix-services/content-proxy@ci<num>` and tagged with the CI build number.
