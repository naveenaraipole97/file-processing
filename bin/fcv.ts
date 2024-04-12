#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FrontendStack } from '../lib/frontend-stack';
import { PresignedUrlStack } from '../lib/presigned-url-stack';
import { BackendStack } from '../lib/backend-stack';
import { WorkerStack } from '../lib/worker-stack';

const app = new cdk.App();

new PresignedUrlStack(app, 'PresignedUrlStack', {});


new FrontendStack(app, 'FrontendStack', {
  preSignedUrlApi: cdk.Fn.importValue('PreSignedApiUrl')
});


new BackendStack(app, 'BackendStack', {});

new WorkerStack(app, 'WorkerStack', {});