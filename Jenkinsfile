def workspace;
node {
    stage "Create build output"
    checkout scm 
     withEnv([
      "PATH=$HOME/.rbenv/bin:$HOME/.rbenv/shims:$PATH",
      "RBENV_SHELL=sh"
     ]){
    sh 'bundle exec cap vagrantbox build' 
     }
}
