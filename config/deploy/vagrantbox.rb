#make sure you have vagrant box running with docker Swarm node configured before deploying
server '127.0.0.1', user: 'vagrant', roles: %w{app}

set :ssh_options, {
       user: 'vagrant', # overrides user setting above
       port: '2222',
       keys: "~/.vagrant.d/insecure_private_key",
       forward_agent: 'yes',
       password: 'please use keys',
      }

set :default_environment, {
        'lc_all' => 'en_US.UTF-8',
      }

set :use_sudo, true
