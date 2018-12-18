def workspace;
node {
    stage "Create build output"
    checkout scm 
     withEnv([
      "PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH",
      "RBENV_SHELL=sh"
     ]){
         dir('config') {
                    sh 'ls -lt'
                    sh 'bundle exec cap vagrantbox build'
        } 
     }
}
