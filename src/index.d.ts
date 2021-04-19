/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { Resolver } from '@adobe/helix-universal'

declare interface Logger {}
declare interface MountConfig {}
declare interface MountPoint {}

/**
 * options for github requests
 */
declare interface GithubOptions {
  cache:string;
  fetchTimeout:number;
  headers:object;
}

/**
 * options for external (service) requests
 */
declare interface ExternalOptions {
  cache:string;
  fetchTimeout:string;
  headers:object;
  namespace:string;
  githubToken:string;

  GOOGLE_DOCS2MD_CLIENT_ID:string;
  GOOGLE_DOCS2MD_CLIENT_SECRET:string;
  GOOGLE_DOCS2MD_REFRESH_TOKEN:string;
  AZURE_WORD2MD_CLIENT_ID:string;
  AZURE_WORD2MD_CLIENT_SECRET:string;
  AZURE_HELIX_USER:string;
  AZURE_HELIX_PASSWORD:string;
}

declare interface FetchFSTabOptions {
  /**
   * github root path
   */
  root:string;

  owner:string;
  repo:string;
  ref:string;

  log:Logger;
  options:GithubOptions;
}

declare interface ReverseLookupOptions {
  mount:MountConfig;
  options:ExternalOptions;
  uri:URL;
  prefix:string;
  owner:string;
  repo:string;
  ref:string;
  report:boolean;
  log:Logger;
}

declare interface EditLookupOptions {
  mount:MountConfig;
  options:ExternalOptions;
  owner:string;
  repo:string;
  ref:string;
  path:string;
  report:boolean;
  log:Logger;
}

declare interface HandlerOptions {
  mp:MountPoint;
  githubRootPath:string;
  owner:string;
  repo:string;
  ref:string;
  path:string;
  log:Logger;
  resolver:Resolver;
}

declare interface GithubHandlerOptions extends HandlerOptions {
  options:GithubOptions;
}

declare interface ExternalHandlerOptions extends HandlerOptions {
  options:ExternalOptions;
}
