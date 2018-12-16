# config valid only for current version of Capistrano
lock "3.11.0"

set :application, "nginx"
set :repo_url, ENV["REPO_URL"] || "git@github.com:Prashanth-Pullaikodi/capistrano.git"
set :ssh_options, {:forward_agent => true}

# Default branch is :master
ask :branch, ENV["REPO_BRANCH"] || `git rev-parse --abbrev-ref HEAD`.chomp

# Default deploy_to directory is /var/www/my_app_name
set :deploy_to, "/home/vagrant/capistrano"
set :linked_dirs, %w(my_shared_directory)
# Default value for :pty is false
set :pty, true

desc 'go'
task :go => ['build', 'push', 'deploy']

desc 'deploy'
task :deploy do
  on roles(:app) do
    execute "docker pull #{fetch(:application)}"
    Rake::Task['deploy:restart'].invoke
  end
end

namespace :deploy do
  task :restart do
    on roles(:app) do
      # in case the app isn't running on the other end
      execute "docker stop #{fetch(:application)} ; true"

      # have to remove it otherwise --restart=always will run it again on reboot!
      execute "docker rm #{fetch(:application)} ; true"

      # modify this to suit how you want to run your app
      execute "docker run -d -p 8081:80 --restart=always --name=#{fetch(:application)}"
    end
  end
end

set :keep_releases, 20