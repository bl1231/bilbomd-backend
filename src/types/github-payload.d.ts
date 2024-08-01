export interface WebhookPayload {
  action: string
  package: Package
  repository: Repository
  organization: Organization
  sender: Sender
}

export interface Package {
  id: number
  name: string
  namespace: string
  description: string
  ecosystem: string
  package_type: string
  html_url: string
  created_at: string
  updated_at: string
  owner: Owner
  package_version: PackageVersion
  registry: Registry
}

export interface Owner {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
}

export interface PackageVersion {
  id: number
  version: string
  name: string
  description: string
  summary: string
  body: Body
  manifest: string
  html_url: string
  target_commitish: string
  target_oid: string
  created_at: string
  updated_at: string
  container_metadata: ContainerMetadata
  installation_command: string
  package_url: string
}

export interface Body {
  repository: BodyRepository
  info: Info
  _mime_type: MimeType
  async_data: AsyncData
  detect_encoding: DetectEncoding
  encoding: string
  ruby_encoding: string
  encoded_newlines_re: string
  language: Language
  _formatted: boolean
}

export interface BodyRepository {
  repository: InnerRepository
}

export interface InnerRepository {
  id: number
  name: string
  owner_id: number
  parent_id: number | null
  sandbox: string | null
  updated_at: string
  created_at: string
  public: boolean
  description: string
  homepage: string
  source_id: number
  public_push: string | null
  disk_usage: number
  locked: boolean
  pushed_at: string
  watcher_count: number
  public_fork_count: number
  primary_language_name_id: number
  has_issues: boolean
  has_wiki: boolean
  has_downloads: boolean
  raw_data: RawData
  organization_id: number
  disabled_at: string | null
  disabled_by: string | null
  disabling_reason: string | null
  health_status: string | null
  pushed_at_usec: number
  active: boolean
  reflog_sync_enabled: boolean
  made_public_at: string | null
  user_hidden: number
  maintained: boolean
  template: boolean
  owner_login: string
  world_writable_wiki: boolean
  refset_updated_at: string
  disabling_detail: string | null
  archived_at: string | null
  deleted_at: string | null
}

export interface RawData {
  data: RawDataDetails
}

export interface RawDataDetails {
  created_by_user_id: number
  primary_language_name: string
}

export interface Info {
  type: string
  oid: string
  mode: number
  name: string
  path: string
  size: number
  collection: boolean
  data: string
  truncated: boolean
  size_over_limit: boolean
  encoding: string
  binary: boolean
}

export interface MimeType {
  extension: string
  content_type: string
  encoding: string
}

export interface AsyncData {
  state: string
  source: string | null
  value: string
}

export interface DetectEncoding {
  encoding: string
  ruby_encoding: string
  confidence: number
}

export interface Language {
  name: string
  fs_name: string | null
  type: string
  types: string[]
  color: string
  aliases: string[]
  tm_scope: string
  ace_mode: string
  codemirror_mode: string
  codemirror_mime_type: string
  wrap: boolean
  language_id: number
  extensions: string[]
  filenames: string[]
  popular: boolean
  group_name: string
}

export interface ContainerMetadata {
  tag: Tag
  labels: Labels
  manifest: Manifest
}

export interface Tag {
  name: string
  digest: string
}

export interface Labels {
  description: string
  source: string
  revision: string
  image_url: string
  licenses: string
  all_labels: Record<string, string>
}

export interface Manifest {
  digest: string
  media_type: string
  uri: string
  size: number
  config: Config
}

export interface Config {
  digest: string
  media_type: string
  size: number
}

export interface Registry {
  about_url: string
  name: string
  type: string
  url: string
  vendor: string
}

export interface Repository {
  id: number
  node_id: string
  name: string
  full_name: string
  private: boolean
  owner: Owner
  html_url: string
  description: string
  fork: boolean
  url: string
  forks_url: string
  keys_url: string
  collaborators_url: string
  teams_url: string
  hooks_url: string
  issue_events_url: string
  events_url: string
  assignees_url: string
  branches_url: string
  tags_url: string
  blobs_url: string
  git_tags_url: string
  git_refs_url: string
  trees_url: string
  statuses_url: string
  languages_url: string
  stargazers_url: string
  contributors_url: string
  subscribers_url: string
  subscription_url: string
  commits_url: string
  git_commits_url: string
  comments_url: string
  issue_comment_url: string
  contents_url: string
  compare_url: string
  merges_url: string
  archive_url: string
  downloads_url: string
  issues_url: string
  pulls_url: string
  milestones_url: string
  notifications_url: string
  labels_url: string
  releases_url: string
  deployments_url: string
  created_at: string
  updated_at: string
  pushed_at: string
  git_url: string
  ssh_url: string
  clone_url: string
  svn_url: string
  homepage: string
  size: number
  stargazers_count: number
  watchers_count: number
  language: string
  has_issues: boolean
  has_projects: boolean
  has_downloads: boolean
  has_wiki: boolean
  has_pages: boolean
  has_discussions: boolean
  forks_count: number
  mirror_url: string | null
  archived: boolean
  disabled: boolean
  open_issues_count: number
  license: string | null
  allow_forking: boolean
  is_template: boolean
  web_commit_signoff_required: boolean
  topics: string[]
  visibility: string
  forks: number
  open_issues: number
  watchers: number
  default_branch: string
}

export interface Organization {
  login: string
  id: number
  node_id: string
  url: string
  repos_url: string
  events_url: string
  hooks_url: string
  issues_url: string
  members_url: string
  public_members_url: string
  avatar_url: string
  description: string
}

export interface Sender {
  login: string
  id: number
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
}
