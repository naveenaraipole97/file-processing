#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FrontendStack } from '../lib/frontend-stack';
import { PresignedUrlStack } from '../lib/presigned-url-stack';
import { BackendStack } from '../lib/backend-stack';
import { WorkerStack } from '../lib/worker-stack';

const app = new cdk.App();

new BackendStack(app, 'BackendStack', {});

new PresignedUrlStack(app, 'PresignedUrlStack', {});

new WorkerStack(app, 'WorkerStack', {});

new FrontendStack(app, 'FrontendStack', {});