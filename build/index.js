"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCHeaderPlugin = exports.staticPreviewPlugin = exports.fsRouterPlugin = void 0;
var fs_router_plugin_1 = require("./internal/fs-router-plugin");
Object.defineProperty(exports, "fsRouterPlugin", { enumerable: true, get: function () { return __importDefault(fs_router_plugin_1).default; } });
var static_preview_plugin_1 = require("./internal/static-preview-plugin");
Object.defineProperty(exports, "staticPreviewPlugin", { enumerable: true, get: function () { return __importDefault(static_preview_plugin_1).default; } });
var generate_c_header_plugin_1 = require("./internal/generate-c-header-plugin");
Object.defineProperty(exports, "generateCHeaderPlugin", { enumerable: true, get: function () { return __importDefault(generate_c_header_plugin_1).default; } });
